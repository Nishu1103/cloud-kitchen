import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_TYPE,
  SYSTEM_ROLES,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { cacheKeys } from '@/common/constants/cache-keys';
import { AppException } from '@/common/exceptions/app.exception';
import { paginated } from '@/common/utils/pagination.util';
import {
  Announcement,
  Role,
  User,
  type AnnouncementDocument,
  type RoleDocument,
  type UserDocument,
} from '@/database/schemas';
import { QUEUES, QueueService } from '@/modules/queue/queue.service';
import { RedisService } from '@/modules/redis/redis.service';
import { UploadsService } from '@/modules/uploads/uploads.service';
import { NotificationsService } from './notifications.service';
import type { CreateAnnouncementDto } from './dto/notifications.dto';

/** A vendor may send this many promotional broadcasts per day. Order updates are unlimited. */
const VENDOR_DAILY_PROMO_LIMIT = 2;
const FANOUT_BATCH_SIZE = 500;

interface AnnouncementJob {
  announcementId: string;
}

/**
 * Campus-wide and vendor broadcasts.
 *
 * Vendor promotions are quota-limited on purpose: the fastest way to lose the
 * notification channel entirely is to let every kitchen push "today's special"
 * whenever it likes until students turn notifications off for good.
 */
@Injectable()
export class AnnouncementsService implements OnModuleInit {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectModel(Announcement.name)
    private readonly announcementModel: Model<AnnouncementDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly redis: RedisService,
    private readonly uploads: UploadsService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker<AnnouncementJob>(
      QUEUES.ANNOUNCEMENTS,
      async (job) => this.dispatch(job.data.announcementId),
      2,
    );
  }

  async create(params: {
    campusId: string;
    createdBy: string;
    vendorId?: string;
    dto: CreateAnnouncementDto;
  }) {
    if (params.vendorId) {
      await this.assertVendorQuota(params.vendorId);
      // A vendor can only ever address customers, never staff or partners.
      const invalid = params.dto.audiences.filter(
        (audience) => audience !== NOTIFICATION_AUDIENCE.CUSTOMER,
      );
      if (invalid.length) {
        throw AppException.forbidden('Vendors can only send announcements to customers.');
      }
    }

    const scheduledFor = params.dto.scheduledFor ? new Date(params.dto.scheduledFor) : undefined;
    if (scheduledFor && scheduledFor.getTime() < Date.now() - 60_000) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'Scheduled time must be in the future.',
      );
    }

    this.uploads.assertPersistedImageUrl(params.dto.imageUrl, {
      campusId: params.campusId,
      userId: params.createdBy,
      vendorId: params.vendorId,
      folders: ['banners'],
      requireOwner: Boolean(params.vendorId),
    });

    const announcement = await this.announcementModel.create({
      campusId: new Types.ObjectId(params.campusId),
      title: params.dto.title,
      body: params.dto.body,
      imageUrl: params.dto.imageUrl,
      deepLink: params.dto.deepLink,
      audiences: params.dto.audiences,
      vendorId: params.vendorId ? new Types.ObjectId(params.vendorId) : null,
      status: scheduledFor ? 'scheduled' : params.dto.sendNow ? 'sending' : 'draft',
      scheduledFor,
      createdBy: new Types.ObjectId(params.createdBy),
    });

    if (params.dto.sendNow && !scheduledFor) {
      await this.queueService.enqueue<AnnouncementJob>(QUEUES.ANNOUNCEMENTS, 'dispatch', {
        announcementId: String(announcement._id),
      });
    } else if (scheduledFor) {
      await this.queueService.enqueue<AnnouncementJob>(
        QUEUES.ANNOUNCEMENTS,
        'dispatch',
        { announcementId: String(announcement._id) },
        { delay: Math.max(0, scheduledFor.getTime() - Date.now()) },
      );
    }

    if (params.vendorId && params.dto.sendNow) await this.consumeVendorQuota(params.vendorId);

    return announcement.toJSON();
  }

  async list(campusId: string, params: { page: number; limit: number; vendorId?: string }) {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (params.vendorId) filter.vendorId = new Types.ObjectId(params.vendorId);

    const [items, total] = await Promise.all([
      this.announcementModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.announcementModel.countDocuments(filter),
    ]);
    return paginated(items, total, params.page, params.limit);
  }

  async sendNow(campusId: string, announcementId: string, vendorId?: string) {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(announcementId),
      campusId: new Types.ObjectId(campusId),
    };
    if (vendorId) filter.vendorId = new Types.ObjectId(vendorId);

    const announcement = await this.announcementModel.findOne(filter);
    if (!announcement) throw AppException.notFound('Announcement');
    if (announcement.status === 'sent' || announcement.status === 'sending') {
      throw AppException.conflict('This announcement has already been sent.');
    }

    if (vendorId) await this.assertVendorQuota(vendorId);

    announcement.status = 'sending';
    await announcement.save();
    await this.queueService.enqueue<AnnouncementJob>(QUEUES.ANNOUNCEMENTS, 'dispatch', {
      announcementId,
    });
    if (vendorId) await this.consumeVendorQuota(vendorId);

    return { queued: true };
  }

  /**
   * Resolves the audience to concrete users and notifies them in batches. Runs in a
   * worker because a campus-wide broadcast can be tens of thousands of recipients.
   */
  private async dispatch(announcementId: string): Promise<void> {
    const announcement = await this.announcementModel.findById(announcementId);
    if (!announcement || announcement.status === 'sent') return;

    const roleSlugs = announcement.audiences.flatMap((audience) => this.audienceRoles(audience));
    const roles = await this.roleModel.find({ slug: { $in: roleSlugs } }).select('_id').lean();

    const cursor = this.userModel
      .find({
        campusId: announcement.campusId,
        status: 'active',
        roleIds: { $in: roles.map((role) => role._id) },
      })
      .select('_id')
      .lean()
      .cursor();

    let batch: string[] = [];
    let recipients = 0;

    const flush = async () => {
      if (!batch.length) return;
      await this.notificationsService.notifyMany(batch, {
        campusId: String(announcement.campusId),
        type: NOTIFICATION_TYPE.BROADCAST_ANNOUNCEMENT,
        title: announcement.title,
        body: announcement.body,
        imageUrl: announcement.imageUrl,
        deepLink: announcement.deepLink,
        data: { announcementId: String(announcement._id) },
        collapseKey: `announcement:${announcement._id}`,
      });
      recipients += batch.length;
      batch = [];
    };

    for await (const user of cursor) {
      batch.push(String(user._id));
      if (batch.length >= FANOUT_BATCH_SIZE) await flush();
    }
    await flush();

    announcement.status = 'sent';
    announcement.sentAt = new Date();
    announcement.recipientCount = recipients;
    await announcement.save();

    this.logger.log(`Announcement ${announcementId} fanned out to ${recipients} user(s).`);
  }

  private audienceRoles(audience: string): string[] {
    switch (audience) {
      case NOTIFICATION_AUDIENCE.CUSTOMER:
        return [SYSTEM_ROLES.CUSTOMER];
      case NOTIFICATION_AUDIENCE.VENDOR:
        return [SYSTEM_ROLES.VENDOR_OWNER, SYSTEM_ROLES.VENDOR_STAFF];
      case NOTIFICATION_AUDIENCE.DELIVERY:
        return [SYSTEM_ROLES.DELIVERY_PARTNER];
      case NOTIFICATION_AUDIENCE.ADMIN:
        return [SYSTEM_ROLES.CAMPUS_ADMIN, SYSTEM_ROLES.SUPPORT_AGENT];
      default:
        return [];
    }
  }

  private quotaKey(vendorId: string): string {
    const day = new Date().toISOString().slice(0, 10);
    return cacheKeys.announcementQuota(vendorId, day);
  }

  private async assertVendorQuota(vendorId: string): Promise<void> {
    const used = Number((await this.redis.client.get(this.quotaKey(vendorId))) ?? 0);
    if (used >= VENDOR_DAILY_PROMO_LIMIT) {
      throw new AppException(
        ERROR_CODES.RATE_LIMITED,
        `You have used today's ${VENDOR_DAILY_PROMO_LIMIT} promotional notifications. Order updates are unaffected.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async consumeVendorQuota(vendorId: string): Promise<void> {
    await this.redis.incrementWithTtl(this.quotaKey(vendorId), 60 * 60 * 26);
  }
}
