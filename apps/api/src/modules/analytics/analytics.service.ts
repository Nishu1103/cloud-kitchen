import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ORDER_STATUS, USER_STATUS, VENDOR_STATUS } from '@ck/types';
import { Model, Types } from 'mongoose';
import { cacheKeys } from '@/common/constants/cache-keys';
import {
  Order,
  Product,
  User,
  Vendor,
  type OrderDocument,
  type ProductDocument,
  type UserDocument,
  type VendorDocument,
} from '@/database/schemas';
import { RedisService } from '@/modules/redis/redis.service';

/** Only completed orders count as revenue. */
const REVENUE_STATUSES = [ORDER_STATUS.DELIVERED];

interface Range {
  from: Date;
  to: Date;
}

/**
 * Read-only aggregations for the dashboards.
 *
 * Every pipeline is anchored on `campusId` (and `vendorId` for the vendor portal) as its
 * first `$match` stage, so a tenant can never see another's numbers and the indexes are
 * actually used. Results are cached briefly - a dashboard does not need to be to the second.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly redis: RedisService,
  ) {}

  async vendorDashboard(campusId: string, vendorId: string, range: Range) {
    const cacheKey = cacheKeys.analyticsVendor(vendorId, this.rangeKey(range));
    const cached = await this.redis.getJson<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const base = {
      campusId: new Types.ObjectId(campusId),
      vendorId: new Types.ObjectId(vendorId),
      createdAt: { $gte: range.from, $lte: range.to },
    };

    const [totals, byStatus, byDay, topItems, liveCount] = await Promise.all([
      this.orderModel.aggregate<{
        orders: number;
        revenue: number;
        payout: number;
        averageOrder: number;
      }>([
        { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: '$breakdown.grandTotal' },
            payout: { $sum: '$vendorPayout' },
            averageOrder: { $avg: '$breakdown.grandTotal' },
          },
        },
      ]),
      this.orderModel.aggregate<{ _id: string; count: number }>([
        { $match: base },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate<{ _id: string; orders: number; revenue: number }>([
        { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$breakdown.grandTotal' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.orderModel.aggregate<{ _id: string; name: string; quantity: number; revenue: number }>([
        { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
        { $unwind: '$lines' },
        {
          $group: {
            _id: '$lines.productId',
            name: { $first: '$lines.name' },
            quantity: { $sum: '$lines.quantity' },
            revenue: { $sum: '$lines.lineTotal' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 },
      ]),
      this.orderModel.countDocuments({
        campusId: new Types.ObjectId(campusId),
        vendorId: new Types.ObjectId(vendorId),
        status: {
          $in: [
            ORDER_STATUS.PLACED,
            ORDER_STATUS.ACCEPTED,
            ORDER_STATUS.PREPARING,
            ORDER_STATUS.READY,
          ],
        },
      }),
    ]);

    const summary = totals[0] ?? { orders: 0, revenue: 0, payout: 0, averageOrder: 0 };
    const countOf = (status: string) =>
      byStatus.find((entry) => entry._id === status)?.count ?? 0;
    const cancelled = countOf(ORDER_STATUS.CANCELLED) + countOf(ORDER_STATUS.REJECTED);

    const result = {
      range,
      totals: {
        orders: summary.orders,
        revenue: summary.revenue,
        payout: summary.payout,
        averageOrderValue: Math.round(summary.averageOrder ?? 0),
        cancelled,
        liveOrders: liveCount,
      },
      byStatus: Object.fromEntries(byStatus.map((entry) => [entry._id, entry.count])),
      timeline: byDay.map((entry) => ({
        date: entry._id,
        orders: entry.orders,
        revenue: entry.revenue,
      })),
      topItems: topItems.map((item) => ({
        productId: String(item._id),
        name: item.name,
        quantity: item.quantity,
        revenue: item.revenue,
      })),
    };

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  async adminDashboard(campusId: string, range: Range) {
    const cacheKey = cacheKeys.analyticsCampus(campusId, this.rangeKey(range));
    const cached = await this.redis.getJson<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const campus = new Types.ObjectId(campusId);
    const base = { campusId: campus, createdAt: { $gte: range.from, $lte: range.to } };

    const [totals, byDay, topVendors, byPaymentMethod, users, vendors, lowStock] =
      await Promise.all([
        this.orderModel.aggregate<{
          orders: number;
          gmv: number;
          commission: number;
          averageOrder: number;
        }>([
          { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              gmv: { $sum: '$breakdown.grandTotal' },
              commission: { $sum: '$commissionAmount' },
              averageOrder: { $avg: '$breakdown.grandTotal' },
            },
          },
        ]),
        this.orderModel.aggregate<{ _id: string; orders: number; gmv: number }>([
          { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              orders: { $sum: 1 },
              gmv: { $sum: '$breakdown.grandTotal' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.orderModel.aggregate<{ _id: string; name: string; orders: number; gmv: number }>([
          { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
          {
            $group: {
              _id: '$vendorId',
              name: { $first: '$vendorName' },
              orders: { $sum: 1 },
              gmv: { $sum: '$breakdown.grandTotal' },
            },
          },
          { $sort: { gmv: -1 } },
          { $limit: 10 },
        ]),
        this.orderModel.aggregate<{ _id: string; count: number; amount: number }>([
          { $match: { ...base, status: { $in: REVENUE_STATUSES } } },
          {
            $group: {
              _id: '$paymentMethod',
              count: { $sum: 1 },
              amount: { $sum: '$breakdown.grandTotal' },
            },
          },
        ]),
        this.userModel.aggregate<{ _id: string; count: number }>([
          { $match: { campusId: campus } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.vendorModel.aggregate<{ _id: string; count: number }>([
          { $match: { campusId: campus } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.productModel.countDocuments({
          campusId: campus,
          trackInventory: true,
          stockQuantity: { $lte: 5 },
        }),
      ]);

    const summary = totals[0] ?? { orders: 0, gmv: 0, commission: 0, averageOrder: 0 };
    const newUsers = await this.userModel.countDocuments({
      campusId: campus,
      createdAt: { $gte: range.from, $lte: range.to },
    });

    const result = {
      range,
      totals: {
        orders: summary.orders,
        gmv: summary.gmv,
        platformRevenue: summary.commission,
        averageOrderValue: Math.round(summary.averageOrder ?? 0),
        newUsers,
        activeUsers: users.find((entry) => entry._id === USER_STATUS.ACTIVE)?.count ?? 0,
        pendingVendors:
          vendors.find((entry) => entry._id === VENDOR_STATUS.PENDING_APPROVAL)?.count ?? 0,
        lowStockProducts: lowStock,
      },
      timeline: byDay.map((entry) => ({ date: entry._id, orders: entry.orders, gmv: entry.gmv })),
      topVendors: topVendors.map((vendor) => ({
        vendorId: String(vendor._id),
        name: vendor.name,
        orders: vendor.orders,
        gmv: vendor.gmv,
      })),
      paymentMix: byPaymentMethod.map((entry) => ({
        method: entry._id,
        count: entry.count,
        amount: entry.amount,
      })),
      usersByStatus: Object.fromEntries(users.map((entry) => [entry._id, entry.count])),
      vendorsByStatus: Object.fromEntries(vendors.map((entry) => [entry._id, entry.count])),
    };

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  /** Hour-of-day demand, used to staff kitchens and schedule happy hours. */
  async peakHours(campusId: string, vendorId: string | undefined, range: Range) {
    const match: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      createdAt: { $gte: range.from, $lte: range.to },
      status: { $in: REVENUE_STATUSES },
    };
    if (vendorId) match.vendorId = new Types.ObjectId(vendorId);

    const rows = await this.orderModel.aggregate<{ _id: number; orders: number; gmv: number }>([
      { $match: match },
      {
        $group: {
          _id: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
          orders: { $sum: 1 },
          gmv: { $sum: '$breakdown.grandTotal' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return Array.from({ length: 24 }, (_, hour) => {
      const row = rows.find((entry) => entry._id === hour);
      return { hour, orders: row?.orders ?? 0, gmv: row?.gmv ?? 0 };
    });
  }

  private rangeKey(range: Range): string {
    return `${range.from.toISOString().slice(0, 10)}:${range.to.toISOString().slice(0, 10)}`;
  }
}
