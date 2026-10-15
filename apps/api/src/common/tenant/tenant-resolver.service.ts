import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Campus, type CampusDocument } from '@/database/schemas';
import { RedisService } from '@/modules/redis/redis.service';
import { cacheKeys } from '../constants/cache-keys';

const SLUG_PATTERN = /^[a-z0-9-]{2,40}$/;
const TTL_SECONDS = 300;
/** Remembers misses too, so a bot spraying slugs cannot turn into a query per request. */
const MISS = '-';

/**
 * Resolves a campus slug to a tenant id for anonymous storefront traffic.
 *
 * Signed-in requests never come here: their tenant comes from the session, which
 * cannot be influenced by the caller. This path exists only for visitors who have
 * no session yet, and it deliberately returns nothing rather than a default campus
 * so a missing slug can never silently read another tenant's data.
 */
@Injectable()
export class TenantResolverService {
  constructor(
    @InjectModel(Campus.name) private readonly campusModel: Model<CampusDocument>,
    private readonly redis: RedisService,
  ) {}

  async resolveSlug(slug: string | undefined): Promise<string | undefined> {
    if (!slug || !SLUG_PATTERN.test(slug)) return undefined;

    const key = cacheKeys.campusBySlug(slug);
    const cached = await this.redis.getJson<string>(key);
    if (cached) return cached === MISS ? undefined : cached;

    const campus = await this.campusModel.findOne({ slug, isActive: true }).select('_id').lean();
    const value = campus ? String(campus._id) : MISS;
    await this.redis.setJson(key, value, TTL_SECONDS);

    return campus ? value : undefined;
  }

  async invalidate(slug: string): Promise<void> {
    await this.redis.del(cacheKeys.campusBySlug(slug));
  }
}
