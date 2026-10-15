import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  USER_STATUS,
  type PaginatedResult,
  type Portal,
  type SessionUser,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { escapeRegex, paginated } from '@/common/utils/pagination.util';
import { User, type UserDocument } from '@/database/schemas';
import { AuthorizationService } from '@/modules/rbac/authorization.service';
import { AuthService } from '@/modules/auth/auth.service';
import { TokenService } from '@/modules/auth/token.service';
import { UploadsService } from '@/modules/uploads/uploads.service';
import type {
  AddressDto,
  AdminUpdateUserDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UserQueryDto,
} from './dto/user.dto';

const MAX_ADDRESSES = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly authorizationService: AuthorizationService,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * The bootstrap payload every portal reads after login.
   *
   * Delegated to `AuthService` so `/me` and `/auth/me` can never drift apart: the four
   * frontends cache one `SessionUser` shape, and a profile save that returned a subset
   * of it would silently drop the portal and the permission set from that cache.
   */
  me(userId: string, portal: Portal): Promise<SessionUser> {
    return this.authService.currentUser(userId, portal);
  }

  async updateProfile(userId: string, portal: Portal, dto: UpdateProfileDto) {
    const existing = await this.userModel.findById(userId).select('campusId').lean();
    if (!existing) throw AppException.notFound('User');
    this.uploads.assertPersistedImageUrl(dto.avatarUrl, {
      campusId: String(existing.campusId),
      userId,
      folders: ['avatars'],
    });

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: this.compact(dto) },
      { new: true, runValidators: true },
    );
    if (!user) throw AppException.notFound('User');
    return this.me(userId, portal);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const update: Record<string, unknown> = {};
    if (dto.locale) update.locale = dto.locale;
    if (dto.dietaryPreference !== undefined) update.dietaryPreference = dto.dietaryPreference;
    if (dto.marketingOptIn !== undefined) update.marketingOptIn = dto.marketingOptIn;

    await this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $set: update });
    return { updated: true };
  }

  async listAddresses(userId: string) {
    const user = await this.userModel.findById(userId).select('addresses').lean();
    if (!user) throw AppException.notFound('User');
    return user.addresses ?? [];
  }

  async addAddress(userId: string, dto: AddressDto) {
    const user = await this.userModel.findById(userId).select('addresses name phone');
    if (!user) throw AppException.notFound('User');

    if ((user.addresses?.length ?? 0) >= MAX_ADDRESSES) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        `You can save up to ${MAX_ADDRESSES} addresses.`,
      );
    }

    const line1 = this.resolveLine1(dto);
    const contactPhone = dto.contactPhone ?? user.phone;
    if (!contactPhone) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        'Add a contact number for this address.',
      );
    }

    const isFirst = (user.addresses?.length ?? 0) === 0;
    if (dto.isDefault || isFirst) {
      user.addresses?.forEach((address) => {
        address.isDefault = false;
      });
    }

    user.addresses.push({
      label: dto.label,
      hostel: dto.hostel,
      roomNumber: dto.roomNumber,
      line1,
      line2: dto.line2,
      landmark: dto.landmark,
      contactName: dto.contactName ?? user.name,
      contactPhone,
      campusZoneId: dto.campusZoneId ? new Types.ObjectId(dto.campusZoneId) : undefined,
      location:
        dto.coordinates ? { type: 'Point', coordinates: dto.coordinates } : undefined,
      isDefault: dto.isDefault || isFirst,
    } as never);

    await user.save();
    return user.addresses;
  }

  async updateAddress(userId: string, addressId: string, dto: AddressDto) {
    const user = await this.userModel.findById(userId).select('addresses');
    if (!user) throw AppException.notFound('User');

    const address = user.addresses?.find((entry) => String(entry._id) === addressId);
    if (!address) throw AppException.notFound('Address');

    if (dto.isDefault) {
      user.addresses?.forEach((entry) => {
        entry.isDefault = false;
      });
    }

    const patch = this.compact(dto);
    Object.assign(address, {
      ...patch,
      // Recomposed from the merged hostel and room so an edit cannot leave the
      // printable line describing the old one.
      line1: this.resolveLine1(
        {
          line1: patch.line1,
          hostel: patch.hostel ?? address.hostel,
          roomNumber: patch.roomNumber ?? address.roomNumber,
        },
        address.line1,
      ),
      campusZoneId: dto.campusZoneId ? new Types.ObjectId(dto.campusZoneId) : address.campusZoneId,
      location: dto.coordinates
        ? { type: 'Point', coordinates: dto.coordinates }
        : address.location,
    });

    await user.save();
    return user.addresses;
  }

  /**
   * On a campus most addresses are a hostel and a room, so `line1` is composed from
   * them when the client does not send a street line. The schema keeps it required so
   * every consumer - invoices, delivery sheets, the rider app - has one line to print.
   */
  private resolveLine1(
    input: Pick<AddressDto, 'line1' | 'hostel' | 'roomNumber'>,
    current?: string,
  ): string {
    const line1 = input.line1?.trim();
    if (line1) return line1;

    const composed = [input.hostel?.trim(), input.roomNumber?.trim()]
      .filter(Boolean)
      .join(', ');
    if (composed) return composed;
    if (current) return current;

    throw AppException.unprocessable(
      ERROR_CODES.VALIDATION_FAILED,
      'Add a hostel and room, or a street address.',
    );
  }

  async removeAddress(userId: string, addressId: string) {
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $pull: { addresses: { _id: new Types.ObjectId(addressId) } } },
    );
    if (result.modifiedCount === 0) throw AppException.notFound('Address');
    return { removed: true };
  }

  async listForAdmin(campusId: string, query: UserQueryDto): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (query.status) filter.status = query.status;
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('name email phone status emailVerified roles walletBalance createdAt lastLoginAt')
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async findForAdmin(campusId: string, userId: string) {
    const user = await this.userModel
      .findOne({ _id: new Types.ObjectId(userId), campusId: new Types.ObjectId(campusId) })
      .select('-passwordHash -emailVerificationTokenHash -passwordResetTokenHash -phoneOtpHash')
      .lean();
    if (!user) throw AppException.notFound('User');
    return user;
  }

  /**
   * Suspending an account revokes every session immediately - a blocked user must not
   * keep browsing on an access token that has not expired yet.
   */
  async adminUpdate(campusId: string, userId: string, dto: AdminUpdateUserDto) {
    const user = await this.userModel.findOneAndUpdate(
      { _id: new Types.ObjectId(userId), campusId: new Types.ObjectId(campusId) },
      { $set: this.compact(dto) },
      { new: true },
    );
    if (!user) throw AppException.notFound('User');

    if (dto.status && dto.status !== USER_STATUS.ACTIVE) {
      await this.tokenService.revokeAllForUser(userId, 'status_change');
    }
    await this.authorizationService.invalidateUser(userId);

    return { id: String(user._id), status: user.status };
  }

  /** Removes personal data while keeping order history for accounting. */
  async deleteAccount(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw AppException.notFound('User');

    const marker = `deleted-${String(user._id)}`;
    user.name = 'Deleted account';
    user.email = `${marker}@deleted.invalid`;
    user.phone = undefined;
    user.avatarUrl = undefined;
    user.addresses = [] as never;
    user.status = USER_STATUS.DELETED;
    user.deletedAt = new Date();
    await user.save();

    await this.tokenService.revokeAllForUser(userId, 'account_deleted');
    await this.authorizationService.invalidateUser(userId);
    return { deleted: true };
  }

  private compact<T extends object>(dto: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }
}
