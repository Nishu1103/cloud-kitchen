import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  NOTIFICATION_TYPE,
  SYSTEM_ROLES,
  VENDOR_STATUS,
  type PaginatedResult,
  type VendorStatus,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { parseQueryFlag } from '@/common/dto/transforms';
import { buildSort, escapeRegex, paginated } from '@/common/utils/pagination.util';
import {
  Role,
  User,
  Vendor,
  type RoleDocument,
  type UserDocument,
  type VendorDocument,
} from '@/database/schemas';
import { MailService } from '@/modules/mail/mail.service';
import { mailTemplates } from '@/modules/mail/mail.templates';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { AuthorizationService } from '@/modules/rbac/authorization.service';
import { UploadsService } from '@/modules/uploads/uploads.service';
import type {
  AdminUpdateVendorDto,
  BrowseVendorsDto,
  CreateVendorDto,
  UpdateVendorDto,
  VendorDecisionDto,
} from './dto/vendor.dto';

/** Maps storefront sort keys onto indexed fields. `popular` keeps the default ranking. */
function resolveVendorSort(sortBy?: string): string | undefined {
  switch (sortBy) {
    case undefined:
    case 'popular':
      return undefined;
    case 'prep':
      return 'avgPrepMinutes';
    case '-prep':
      return '-avgPrepMinutes';
    case 'rating':
      return '-rating';
    default:
      return sortBy;
  }
}

/** Fields safe to expose to customers. Payout details and documents are excluded. */
const PUBLIC_PROJECTION =
  'slug name tagline description logoUrl coverUrl cuisines isOpen acceptsDelivery ' +
  'acceptsPickup rating ratingCount avgPrepMinutes minOrderAmount packagingFee deliveryFee ' +
  'operatingHours themeColor status campusId';

@Injectable()
export class VendorsService {
  constructor(
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly authorization: AuthorizationService,
    private readonly mailService: MailService,
    private readonly uploads: UploadsService,
  ) {}

  /** Customer-facing listing: approved kitchens only, ordered so open ones lead. */
  async browse(campusId: string, query: BrowseVendorsDto): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      status: VENDOR_STATUS.APPROVED,
      deletedAt: { $exists: false },
    };
    if (query.cuisine) filter.cuisines = query.cuisine;
    if (parseQueryFlag(query.openOnly)) filter.isOpen = true;
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: pattern }, { cuisines: pattern }, { tagline: pattern }];
    }

    const sort = buildSort(resolveVendorSort(query.sortBy), ['rating', 'name', 'avgPrepMinutes'], {
      isOpen: -1,
      sortWeight: -1,
      rating: -1,
    });

    const [items, total] = await Promise.all([
      this.vendorModel
        .find(filter)
        .select(PUBLIC_PROJECTION)
        .sort(sort)
        .skip(query.skip)
        .limit(query.limit)
        .lean(),
      this.vendorModel.countDocuments(filter),
    ]);

    return paginated(items, total, query.page, query.limit);
  }

  async findPublicBySlug(campusId: string, slug: string) {
    const vendor = await this.vendorModel
      .findOne({
        campusId: new Types.ObjectId(campusId),
        slug,
        status: VENDOR_STATUS.APPROVED,
        deletedAt: { $exists: false },
      })
      .select(PUBLIC_PROJECTION)
      .lean();
    if (!vendor) throw AppException.notFound('Kitchen');
    return vendor;
  }

  async findForOwner(vendorId: string, campusId: string) {
    const vendor = await this.vendorModel
      .findOne({ _id: new Types.ObjectId(vendorId), campusId: new Types.ObjectId(campusId) })
      .lean();
    if (!vendor) throw AppException.notFound('Kitchen');
    return vendor;
  }

  async listForAdmin(
    campusId: string,
    query: BrowseVendorsDto & { status?: VendorStatus },
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (query.status) filter.status = query.status;
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');

    const [items, total] = await Promise.all([
      this.vendorModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean(),
      this.vendorModel.countDocuments(filter),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async findForAdmin(vendorId: string, campusId: string) {
    const vendor = await this.vendorModel.findOne({
      _id: new Types.ObjectId(vendorId),
      campusId: new Types.ObjectId(campusId),
    });
    if (!vendor) throw AppException.notFound('Kitchen');
    return vendor.toJSON();
  }

  /**
   * Creates a kitchen in `pending_approval` and links the calling user as its owner.
   * A vendor is never live on the strength of its own submission.
   */
  async create(campusId: string, ownerId: string, dto: CreateVendorDto) {
    const clash = await this.vendorModel.exists({
      campusId: new Types.ObjectId(campusId),
      slug: dto.slug,
    });
    if (clash) throw AppException.conflict('That kitchen handle is already taken.');

    const owner = await this.userModel.findById(ownerId);
    if (!owner) throw AppException.notFound('User');
    if (owner.vendorId) throw AppException.conflict('This account already owns a kitchen.');

    const vendor = await this.vendorModel.create({
      campusId: new Types.ObjectId(campusId),
      ...dto,
      ownerId: owner._id,
      status: VENDOR_STATUS.PENDING_APPROVAL,
      isOpen: false,
    });

    const vendorRole = await this.roleModel
      .findOne({ slug: SYSTEM_ROLES.VENDOR_OWNER })
      .select('_id')
      .lean();
    if (vendorRole) {
      // Vendor permissions are granted now, but the kitchen stays invisible until approved.
      owner.roleIds = [...new Set([...owner.roleIds.map(String), String(vendorRole._id)])].map(
        (id) => new Types.ObjectId(id),
      );
    }
    owner.vendorId = vendor._id;
    await owner.save();
    await this.authorization.invalidateUser(ownerId);

    return vendor.toJSON();
  }

  async update(vendorId: string, campusId: string, dto: UpdateVendorDto) {
    const vendor = await this.vendorModel.findOne({
      _id: new Types.ObjectId(vendorId),
      campusId: new Types.ObjectId(campusId),
    });
    if (!vendor) throw AppException.notFound('Kitchen');

    this.uploads.assertPersistedImageUrl(dto.logoUrl, {
      campusId,
      vendorId,
      folders: ['kitchen'],
    });
    this.uploads.assertPersistedImageUrl(dto.coverUrl, {
      campusId,
      vendorId,
      folders: ['kitchen'],
    });

    Object.assign(vendor, dto);
    await vendor.save();
    return vendor.toJSON();
  }

  async adminUpdate(vendorId: string, campusId: string, dto: AdminUpdateVendorDto) {
    const vendor = await this.vendorModel.findOneAndUpdate(
      { _id: new Types.ObjectId(vendorId), campusId: new Types.ObjectId(campusId) },
      { $set: dto },
      { new: true },
    );
    if (!vendor) throw AppException.notFound('Kitchen');
    return vendor.toJSON();
  }

  /** A closed kitchen keeps its menu visible but cannot receive orders. */
  async setOpen(vendorId: string, campusId: string, isOpen: boolean) {
    const vendor = await this.vendorModel.findOne({
      _id: new Types.ObjectId(vendorId),
      campusId: new Types.ObjectId(campusId),
    });
    if (!vendor) throw AppException.notFound('Kitchen');
    if (isOpen && vendor.status !== VENDOR_STATUS.APPROVED) {
      throw AppException.unprocessable(
        ERROR_CODES.VENDOR_CLOSED,
        'Your kitchen must be approved before you can open it.',
      );
    }

    vendor.isOpen = isOpen;
    await vendor.save();
    return vendor.toJSON();
  }

  async decide(vendorId: string, campusId: string, dto: VendorDecisionDto, actorId: string) {
    const vendor = await this.vendorModel.findOne({
      _id: new Types.ObjectId(vendorId),
      campusId: new Types.ObjectId(campusId),
    });
    if (!vendor) throw AppException.notFound('Kitchen');

    vendor.status = dto.status;
    if (dto.status === VENDOR_STATUS.APPROVED) {
      vendor.approvedAt = new Date();
      vendor.approvedBy = new Types.ObjectId(actorId);
      vendor.rejectionReason = undefined;
    } else {
      vendor.isOpen = false;
      vendor.rejectionReason = dto.reason;
    }
    await vendor.save();

    if (vendor.ownerId) {
      const outcome =
        dto.status === VENDOR_STATUS.APPROVED
          ? 'approved'
          : dto.status === VENDOR_STATUS.SUSPENDED
            ? 'suspended'
            : 'rejected';
      const notice =
        outcome === 'approved'
          ? {
              type: NOTIFICATION_TYPE.VENDOR_APPROVED,
              title: 'Your kitchen is approved',
              body: 'You can publish your menu and start taking orders.',
            }
          : outcome === 'suspended'
            ? {
                type: NOTIFICATION_TYPE.VENDOR_SUSPENDED,
                title: 'Your kitchen has been suspended',
                body: dto.reason ?? 'Campus operations has paused your kitchen.',
              }
            : {
                type: NOTIFICATION_TYPE.VENDOR_REJECTED,
                title: 'Kitchen application update',
                body: dto.reason ?? 'Your application was not approved.',
              };

      await this.notificationsService.notify({
        userId: String(vendor.ownerId),
        campusId,
        type: notice.type,
        title: notice.title,
        body: notice.body,
        deepLink: '/',
      });

      const owner = await this.userModel.findById(vendor.ownerId).select('email name').lean();
      if (owner?.email) {
        await this.mailService
          .send({
            to: owner.email,
            ...mailTemplates.vendorDecision(owner.name, outcome, dto.reason),
          })
          .catch(() => undefined);
      }
    }

    return vendor.toJSON();
  }

  /**
   * Stores the denormalised rating. The caller recomputes it from the review
   * collection rather than incrementing, so hiding a review or re-running the job
   * converges on the truth instead of drifting.
   */
  async setRating(vendorId: string, average: number, count: number): Promise<void> {
    await this.vendorModel.updateOne(
      { _id: new Types.ObjectId(vendorId) },
      { $set: { rating: Math.round(average * 100) / 100, ratingCount: count } },
    );
  }

  /** Shared guard for vendor-scoped endpoints and order operations. */
  async assertOperable(vendorId: string, campusId: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findOne({
      _id: new Types.ObjectId(vendorId),
      campusId: new Types.ObjectId(campusId),
      status: VENDOR_STATUS.APPROVED,
      deletedAt: { $exists: false },
    });
    if (!vendor) throw AppException.notFound('Kitchen');
    if (!vendor.isOpen) {
      throw AppException.unprocessable(
        ERROR_CODES.VENDOR_CLOSED,
        `${vendor.name} is not accepting orders right now.`,
      );
    }
    return vendor;
  }
}
