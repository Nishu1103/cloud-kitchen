import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { USER_STATUS, type Permission, type SystemRole } from '@ck/types';
import { Model, Types } from 'mongoose';
import { cacheKeys } from '@/common/constants/cache-keys';
import { RedisService } from '@/modules/redis/redis.service';
import { Role, User, type RoleDocument, type UserDocument } from '@/database/schemas';

export interface Principal {
  id: string;
  campusId: string;
  roles: SystemRole[];
  permissions: Permission[];
  vendorId?: string;
}

const CACHE_TTL_SECONDS = 300;
const VERSION_KEY = 'auth:perms:version';

/**
 * Resolves the effective permission set for a user on every authenticated request.
 *
 * Permissions deliberately do not live in the JWT. If they did, revoking a role
 * would not take effect until the access token expired, which is exactly the
 * window an attacker or a fired staff member would use. Resolution is cached in
 * Redis and the whole cache is invalidated by bumping a version counter, so a role
 * edit applies platform-wide on the next request.
 */
@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly redis: RedisService,
  ) {}

  async resolvePrincipal(userId: string): Promise<Principal | null> {
    if (!Types.ObjectId.isValid(userId)) return null;

    const version = await this.currentVersion();
    const cacheKey = `${cacheKeys.userPermissions(userId)}:${version}`;

    const cached = await this.redis.getJson<Principal>(cacheKey);
    if (cached) return cached;

    const user = await this.userModel
      .findOne({ _id: new Types.ObjectId(userId), deletedAt: { $exists: false } })
      .select('campusId status roleIds directPermissions vendorId')
      .lean();

    if (!user) return null;
    if (user.status !== USER_STATUS.ACTIVE) {
      this.logger.warn(`Rejected request for ${user.status} user ${userId}.`);
      return null;
    }

    const roles = user.roleIds?.length
      ? await this.roleModel
          .find({ _id: { $in: user.roleIds } })
          .select('slug permissions')
          .lean()
      : [];

    const permissions = new Set<Permission>(user.directPermissions ?? []);
    for (const role of roles) {
      for (const permission of role.permissions) permissions.add(permission);
    }

    const principal: Principal = {
      id: userId,
      campusId: String(user.campusId),
      roles: roles.map((role) => role.slug as SystemRole),
      permissions: [...permissions],
      vendorId: user.vendorId ? String(user.vendorId) : undefined,
    };

    await this.redis.setJson(cacheKey, principal, CACHE_TTL_SECONDS);
    return principal;
  }

  /** Call after changing a single user's roles, status, or vendor binding. */
  async invalidateUser(userId: string): Promise<void> {
    await this.redis.deleteByPattern(`${cacheKeys.userPermissions(userId)}:*`);
  }

  /**
   * Call after editing a role. Bumping the version orphans every cached principal
   * at once, which is far cheaper than finding and deleting each affected user.
   */
  async invalidateAll(): Promise<void> {
    await this.redis.client.incr(VERSION_KEY);
  }

  private async currentVersion(): Promise<string> {
    return (await this.redis.client.get(VERSION_KEY)) ?? '1';
  }
}
