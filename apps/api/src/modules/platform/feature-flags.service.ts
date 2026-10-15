import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FEATURE_FLAGS, type FeatureFlagKey } from '@ck/types';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { cacheKeys } from '@/common/constants/cache-keys';
import { FeatureFlag, type FeatureFlagDocument } from '@/database/schemas';
import { RedisService } from '@/modules/redis/redis.service';

const CACHE_TTL_SECONDS = 60;

interface ResolvedFlag {
  enabled: boolean;
  rolloutPercent: number;
  config: Record<string, unknown>;
}

/**
 * Runtime feature switches. Campaign features ship dark and are turned on per
 * campus; `rolloutPercent` ramps them using a stable hash of the user id, so a
 * given student's experience does not flicker between requests.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectModel(FeatureFlag.name) private readonly flagModel: Model<FeatureFlagDocument>,
    private readonly redis: RedisService,
  ) {}

  async isEnabled(campusId: string, key: string, userId?: string): Promise<boolean> {
    const flags = await this.load(campusId);
    const flag = flags[key];
    if (!flag?.enabled) return false;
    if (flag.rolloutPercent >= 100) return true;
    if (!userId) return false;

    const bucket = Number.parseInt(
      createHash('sha256').update(`${key}:${userId}`).digest('hex').slice(0, 8),
      16,
    );
    return bucket % 100 < flag.rolloutPercent;
  }

  /** Shape the frontends consume to hide or show campaign UI. */
  async publicFlags(campusId: string, userId?: string): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const key of FEATURE_FLAGS) {
      result[key] = await this.isEnabled(campusId, key, userId);
    }
    return result;
  }

  async listForAdmin(campusId: string) {
    const existing = await this.flagModel
      .find({ $or: [{ campusId: null }, { campusId: new Types.ObjectId(campusId) }] })
      .lean();

    // Surface every known flag, including ones never written to the database yet.
    return FEATURE_FLAGS.map((key) => {
      const row = existing.find((flag) => flag.key === key && flag.campusId);
      const platform = existing.find((flag) => flag.key === key && !flag.campusId);
      const source = row ?? platform;
      return {
        key,
        enabled: source?.enabled ?? false,
        rolloutPercent: source?.rolloutPercent ?? 100,
        description: source?.description,
        config: source?.config ?? {},
        scope: row ? 'campus' : platform ? 'platform' : 'unset',
      };
    });
  }

  async upsert(params: {
    campusId: string;
    key: FeatureFlagKey;
    enabled: boolean;
    rolloutPercent?: number;
    config?: Record<string, unknown>;
    updatedBy: string;
  }) {
    const flag = await this.flagModel.findOneAndUpdate(
      { campusId: new Types.ObjectId(params.campusId), key: params.key },
      {
        $set: {
          enabled: params.enabled,
          rolloutPercent: params.rolloutPercent ?? 100,
          ...(params.config ? { config: params.config } : {}),
          updatedBy: new Types.ObjectId(params.updatedBy),
        },
      },
      { new: true, upsert: true },
    );

    await this.redis.del(cacheKeys.featureFlags(params.campusId));
    return flag.toJSON();
  }

  private async load(campusId: string): Promise<Record<string, ResolvedFlag>> {
    const cacheKey = cacheKeys.featureFlags(campusId);
    const cached = await this.redis.getJson<Record<string, ResolvedFlag>>(cacheKey);
    if (cached) return cached;

    const rows = await this.flagModel
      .find({ $or: [{ campusId: null }, { campusId: new Types.ObjectId(campusId) }] })
      .lean();

    const resolved: Record<string, ResolvedFlag> = {};
    for (const row of rows.filter((flag) => !flag.campusId)) {
      resolved[row.key] = {
        enabled: row.enabled,
        rolloutPercent: row.rolloutPercent,
        config: row.config,
      };
    }
    for (const row of rows.filter((flag) => flag.campusId)) {
      resolved[row.key] = {
        enabled: row.enabled,
        rolloutPercent: row.rolloutPercent,
        config: row.config,
      };
    }

    await this.redis.setJson(cacheKey, resolved, CACHE_TTL_SECONDS);
    return resolved;
  }
}
