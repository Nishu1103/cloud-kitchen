import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { COUPON_TYPE, ERROR_CODES, percentOf, type Paise } from '@ck/types';
import { Model, Types, type ClientSession } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { paginated } from '@/common/utils/pagination.util';
import {
  Coupon,
  CouponRedemption,
  Order,
  type CouponDocument,
  type CouponRedemptionDocument,
  type OrderDocument,
} from '@/database/schemas';
import type { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

export interface CouponEvaluation {
  couponId: string;
  code: string;
  discount: Paise;
  freeDelivery: boolean;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private readonly couponModel: Model<CouponDocument>,
    @InjectModel(CouponRedemption.name)
    private readonly redemptionModel: Model<CouponRedemptionDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  /**
   * Evaluates a coupon against a concrete basket.
   *
   * Called during pricing on every quote and again inside the order transaction, so
   * a coupon that expires or hits its cap between "view cart" and "pay" cannot slip
   * through. The discount is computed here and never accepted from the client.
   */
  async evaluate(params: {
    campusId: string;
    userId: string;
    vendorId: string;
    code: string;
    itemsTotal: Paise;
  }): Promise<CouponEvaluation> {
    const coupon = await this.couponModel.findOne({
      campusId: new Types.ObjectId(params.campusId),
      code: params.code.toUpperCase(),
      isActive: true,
    });

    const reject = (message: string): never => {
      throw AppException.unprocessable(ERROR_CODES.COUPON_INVALID, message);
    };

    if (!coupon) reject('That coupon code is not valid.');

    const now = new Date();
    if (coupon!.validFrom > now) reject('This coupon is not active yet.');
    if (coupon!.validTo < now) reject('This coupon has expired.');

    if (coupon!.vendorId && String(coupon!.vendorId) !== params.vendorId) {
      reject('This coupon only applies to a different kitchen.');
    }

    if (coupon!.restrictedToUserIds?.length) {
      const allowed = coupon!.restrictedToUserIds.some(
        (userId) => String(userId) === params.userId,
      );
      if (!allowed) reject('That coupon code is not valid.');
    }

    if (params.itemsTotal < coupon!.minOrderAmount) {
      reject(
        `Add items worth ₹${((coupon!.minOrderAmount - params.itemsTotal) / 100).toFixed(0)} more to use this coupon.`,
      );
    }

    if (coupon!.usageLimitTotal !== undefined && coupon!.usedCount >= coupon!.usageLimitTotal) {
      reject('This coupon has been fully claimed.');
    }

    if (coupon!.usageLimitPerUser) {
      const used = await this.redemptionModel.countDocuments({
        couponId: coupon!._id,
        userId: new Types.ObjectId(params.userId),
      });
      if (used >= coupon!.usageLimitPerUser) reject('You have already used this coupon.');
    }

    if (coupon!.firstOrderOnly) {
      const previous = await this.orderModel.countDocuments({
        customerId: new Types.ObjectId(params.userId),
        status: { $nin: ['draft', 'cancelled', 'rejected'] },
      });
      if (previous > 0) reject('This coupon is only valid on your first order.');
    }

    let discount = 0;
    let freeDelivery = false;

    switch (coupon!.type) {
      case COUPON_TYPE.FLAT:
        discount = Math.min(coupon!.value, params.itemsTotal);
        break;
      case COUPON_TYPE.PERCENTAGE: {
        const raw = percentOf(params.itemsTotal, coupon!.value);
        discount = coupon!.maxDiscount ? Math.min(raw, coupon!.maxDiscount) : raw;
        break;
      }
      case COUPON_TYPE.FREE_DELIVERY:
        freeDelivery = true;
        break;
      case COUPON_TYPE.BUY_X_GET_Y:
        // Basket-composition offers are evaluated by the pricing service, which has
        // the line detail; nothing is discounted here.
        discount = 0;
        break;
    }

    return {
      couponId: String(coupon!._id),
      code: coupon!.code,
      discount: Math.max(0, Math.min(discount, params.itemsTotal)),
      freeDelivery,
    };
  }

  /**
   * Records the redemption inside the order transaction. The unique index on
   * (couponId, orderId) plus the conditional `$inc` make double-spend impossible
   * even under concurrent submits.
   */
  async redeem(
    params: {
      couponId: string;
      userId: string;
      orderId: string;
      discountAmount: Paise;
    },
    session: ClientSession,
  ): Promise<void> {
    const result = await this.couponModel.updateOne(
      {
        _id: new Types.ObjectId(params.couponId),
        isActive: true,
        $or: [
          { usageLimitTotal: { $exists: false } },
          { $expr: { $lt: ['$usedCount', '$usageLimitTotal'] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      { session },
    );

    if (!result.modifiedCount) {
      throw AppException.unprocessable(
        ERROR_CODES.COUPON_INVALID,
        'This coupon was just fully claimed. Please remove it and try again.',
      );
    }

    await this.redemptionModel.create(
      [
        {
          couponId: new Types.ObjectId(params.couponId),
          userId: new Types.ObjectId(params.userId),
          orderId: new Types.ObjectId(params.orderId),
          discountAmount: params.discountAmount,
        },
      ],
      { session },
    );
  }

  async releaseRedemption(orderId: string, session?: ClientSession): Promise<void> {
    const redemption = await this.redemptionModel.findOneAndDelete(
      { orderId: new Types.ObjectId(orderId) },
      session ? { session } : {},
    );
    if (!redemption) return;
    await this.couponModel.updateOne(
      { _id: redemption.couponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      session ? { session } : {},
    );
  }

  /** Coupons a customer can actually use right now, for the offers screen. */
  async listAvailable(campusId: string, userId: string, vendorId?: string) {
    const now = new Date();
    return this.couponModel
      .find({
        campusId: new Types.ObjectId(campusId),
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now },
        $and: [
          {
            $or: [
              { restrictedToUserIds: { $size: 0 } },
              { restrictedToUserIds: new Types.ObjectId(userId) },
            ],
          },
          vendorId
            ? { $or: [{ vendorId: null }, { vendorId: new Types.ObjectId(vendorId) }] }
            : {},
        ],
      })
      .select('code title description type value maxDiscount minOrderAmount validTo vendorId')
      .sort({ minOrderAmount: 1 })
      .limit(30)
      .lean();
  }

  async listForAdmin(campusId: string, page: number, limit: number, vendorId?: string) {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (vendorId) filter.vendorId = new Types.ObjectId(vendorId);

    const [items, total] = await Promise.all([
      this.couponModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.couponModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  async create(campusId: string, createdBy: string, dto: CreateCouponDto, vendorId?: string) {
    const validFrom = new Date(dto.validFrom);
    const validTo = new Date(dto.validTo);
    if (validTo <= validFrom) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'The end date must be after the start date.',
      );
    }
    if (dto.type === COUPON_TYPE.PERCENTAGE && dto.value > 100) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'A percentage discount cannot exceed 100.',
      );
    }

    const exists = await this.couponModel.exists({
      campusId: new Types.ObjectId(campusId),
      code: dto.code.toUpperCase(),
    });
    if (exists) throw AppException.conflict('A coupon with that code already exists.');

    return this.couponModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
      campusId: new Types.ObjectId(campusId),
      // A vendor-created coupon is funded by that vendor and scoped to it.
      vendorId: vendorId ? new Types.ObjectId(vendorId) : null,
      validFrom,
      validTo,
      createdBy: new Types.ObjectId(createdBy),
    });
  }

  async update(campusId: string, couponId: string, dto: UpdateCouponDto, vendorId?: string) {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(couponId),
      campusId: new Types.ObjectId(campusId),
    };
    if (vendorId) filter.vendorId = new Types.ObjectId(vendorId);

    const coupon = await this.couponModel.findOneAndUpdate(filter, { $set: dto }, { new: true });
    if (!coupon) throw AppException.notFound('Coupon');
    return coupon.toJSON();
  }
}
