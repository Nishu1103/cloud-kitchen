import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  type PaginatedResult,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { paginated } from '@/common/utils/pagination.util';
import {
  Order,
  Review,
  Vendor,
  type OrderDocument,
  type ReviewDocument,
  type VendorDocument,
} from '@/database/schemas';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { VendorsService } from '@/modules/vendors/vendors.service';
import type { CreateReviewDto, VendorReplyDto } from './dto/review.dto';

/**
 * Reviews are only accepted from a customer who actually received the order, one per
 * order. That single rule is what keeps ratings from being gamed.
 */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly vendorsService: VendorsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(campusId: string, userId: string, dto: CreateReviewDto) {
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(dto.orderId),
        campusId: new Types.ObjectId(campusId),
        customerId: new Types.ObjectId(userId),
      })
      .select('status vendorId vendorName customerName code lines')
      .lean();
    if (!order) throw AppException.notFound('Order');

    if (order.status !== ORDER_STATUS.DELIVERED) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        'You can rate an order once it has been delivered.',
      );
    }

    const existing = await this.reviewModel.exists({ orderId: order._id });
    if (existing) throw AppException.conflict('You have already reviewed this order.');

    // A product rating must belong to something the customer actually ordered.
    if (dto.productId) {
      const ordered = order.lines.some((line) => String(line.productId) === dto.productId);
      if (!ordered) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          'That item was not part of this order.',
        );
      }
    }

    const review = await this.reviewModel.create({
      campusId: new Types.ObjectId(campusId),
      orderId: order._id,
      customerId: new Types.ObjectId(userId),
      customerName: dto.anonymous ? 'A student' : order.customerName,
      vendorId: order.vendorId,
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      rating: dto.rating,
      foodRating: dto.foodRating,
      deliveryRating: dto.deliveryRating,
      comment: dto.comment,
      images: dto.images ?? [],
      isAnonymous: dto.anonymous ?? false,
      isVerifiedPurchase: true,
    });

    await this.refreshVendorRating(String(order.vendorId));

    const vendor = await this.vendorModel.findById(order.vendorId).select('ownerId').lean();
    if (vendor?.ownerId) {
      await this.notificationsService.notify({
        userId: String(vendor.ownerId),
        campusId,
        type: NOTIFICATION_TYPE.VENDOR_NEW_REVIEW,
        title: `New ${dto.rating}-star review`,
        body: dto.comment?.slice(0, 120) ?? `A customer rated order ${order.code}.`,
        deepLink: `/reviews/${String(review._id)}`,
      });
    }

    return review.toJSON();
  }

  async listForVendor(
    vendorId: string,
    params: { page: number; limit: number; rating?: number },
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {
      vendorId: new Types.ObjectId(vendorId),
      isHidden: { $ne: true },
    };
    if (params.rating) filter.rating = params.rating;

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .select('-customerId')
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);
    return paginated(items, total, params.page, params.limit);
  }

  async listForProduct(productId: string, page: number, limit: number) {
    const filter = { productId: new Types.ObjectId(productId), isHidden: { $ne: true } };
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .select('-customerId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  async listMine(campusId: string, userId: string, page: number, limit: number) {
    const filter = {
      campusId: new Types.ObjectId(campusId),
      customerId: new Types.ObjectId(userId),
    };
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  async reply(vendorId: string, reviewId: string, dto: VendorReplyDto) {
    const review = await this.reviewModel.findOneAndUpdate(
      { _id: new Types.ObjectId(reviewId), vendorId: new Types.ObjectId(vendorId) },
      { $set: { vendorReply: dto.reply, vendorRepliedAt: new Date() } },
      { new: true },
    );
    if (!review) throw AppException.notFound('Review');

    await this.notificationsService.notify({
      userId: String(review.customerId),
      campusId: String(review.campusId),
      type: NOTIFICATION_TYPE.REVIEW_REPLY,
      title: 'The kitchen replied to your review',
      body: dto.reply.slice(0, 120),
      deepLink: `/reviews/${reviewId}`,
    });

    return review.toJSON();
  }

  /** Moderation: hidden reviews stop counting towards the vendor's rating. */
  async setHidden(campusId: string, reviewId: string, isHidden: boolean, reason?: string) {
    const review = await this.reviewModel.findOneAndUpdate(
      { _id: new Types.ObjectId(reviewId), campusId: new Types.ObjectId(campusId) },
      { $set: { isHidden, moderationReason: reason } },
      { new: true },
    );
    if (!review) throw AppException.notFound('Review');

    await this.refreshVendorRating(String(review.vendorId));
    return review.toJSON();
  }

  /** Recomputed from visible reviews only, so moderation is reflected immediately. */
  private async refreshVendorRating(vendorId: string): Promise<void> {
    const [aggregate] = await this.reviewModel.aggregate<{ average: number; count: number }>([
      { $match: { vendorId: new Types.ObjectId(vendorId), isHidden: { $ne: true } } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await this.vendorsService.setRating(vendorId, aggregate?.average ?? 0, aggregate?.count ?? 0);
  }

  async listForAdmin(
    campusId: string,
    params: { page: number; limit: number; hidden?: boolean },
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (params.hidden !== undefined) filter.isHidden = params.hidden;

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);
    return paginated(items, total, params.page, params.limit);
  }
}
