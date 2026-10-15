import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { cacheKeys } from '@/common/constants/cache-keys';
import { Setting, type SettingDocument } from '@/database/schemas';
import { RedisService } from '@/modules/redis/redis.service';

const CACHE_TTL_SECONDS = 120;

/**
 * Operational configuration that operators change without a deploy: tax rate,
 * delivery radius, payout cadence, quotas. Cached per campus and invalidated on write.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
    private readonly redis: RedisService,
  ) {}

  async get<T>(campusId: string, group: string, key: string, fallback: T): Promise<T> {
    const all = await this.loadCampusSettings(campusId);
    const value = all[`${group}.${key}`];
    return (value as T) ?? fallback;
  }

  async getNumber(
    campusId: string,
    group: string,
    key: string,
    fallback: number,
  ): Promise<number> {
    const value = await this.get<unknown>(campusId, group, key, fallback);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async getBoolean(
    campusId: string,
    group: string,
    key: string,
    fallback: boolean,
  ): Promise<boolean> {
    const value = await this.get<unknown>(campusId, group, key, fallback);
    return typeof value === 'boolean' ? value : fallback;
  }

  /** Sensitive settings are excluded so they cannot leak through the admin UI. */
  async listPublic(campusId: string) {
    return this.settingModel
      .find({
        $or: [{ campusId: null }, { campusId: new Types.ObjectId(campusId) }],
        isSensitive: false,
      })
      .select('group key value description')
      .lean();
  }

  async upsert(params: {
    campusId: string;
    group: string;
    key: string;
    value: unknown;
    updatedBy: string;
    isSensitive?: boolean;
  }) {
    const setting = await this.settingModel.findOneAndUpdate(
      {
        campusId: new Types.ObjectId(params.campusId),
        group: params.group,
        key: params.key,
      },
      {
        $set: {
          value: params.value,
          isSensitive: params.isSensitive ?? false,
          updatedBy: new Types.ObjectId(params.updatedBy),
        },
      },
      { new: true, upsert: true },
    );

    await this.redis.del(cacheKeys.settings(params.campusId));
    return setting.toJSON();
  }

  private async loadCampusSettings(campusId: string): Promise<Record<string, unknown>> {
    const cacheKey = cacheKeys.settings(campusId);
    const cached = await this.redis.getJson<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const rows = await this.settingModel
      .find({ $or: [{ campusId: null }, { campusId: new Types.ObjectId(campusId) }] })
      .select('group key value campusId')
      .lean();

    const flattened: Record<string, unknown> = {};
    // Campus-specific rows are applied last so they win over platform defaults.
    for (const row of rows.filter((entry) => !entry.campusId)) {
      flattened[`${row.group}.${row.key}`] = row.value;
    }
    for (const row of rows.filter((entry) => entry.campusId)) {
      flattened[`${row.group}.${row.key}`] = row.value;
    }

    await this.redis.setJson(cacheKey, flattened, CACHE_TTL_SECONDS);
    return flattened;
  }
}
