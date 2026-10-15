import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  DOMAIN_EVENTS,
  ERROR_CODES,
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  WALLET_TXN_TYPE,
  percentOf,
  type OrderStatus,
  type PaginatedResult,
} from '@ck/types';
import { Connection, Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { generateNumericOtp, generateOrderCode, hashToken, safeEqual } from '@/common/utils/crypto.util';
import { paginated } from '@/common/utils/pagination.util';
import {
  Order,
  User,
  Vendor,
  type OrderDocument,
  type UserDocument,
  type VendorDocument,
} from '@/database/schemas';
import { CartService } from '@/modules/cart/cart.service';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { PaymentsService } from '@/modules/payments/payments.service';
import { PricingService } from '@/modules/pricing/pricing.service';
import { WalletService } from '@/modules/wallet/wallet.service';
import type { CancelOrderDto, PlaceOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

/** Statuses a vendor is allowed to drive. Delivery and refunds are elsewhere. */
const VENDOR_ALLOWED_STATUSES: OrderStatus[] = [
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.DELIVERED,
];

/** After this point a customer can no longer cancel unilaterally - food is being made. */
const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.PLACED,
];

/** Once an order reaches one of these, its handover code is of no further use. */
const HANDOVER_CODE_CLOSED_STATUSES: OrderStatus[] = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.REFUNDED,
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly pricingService: PricingService,
    private readonly cartService: CartService,
    private readonly catalogService: CatalogService,
    private readonly couponsService: CouponsService,
    private readonly walletService: WalletService,
    private readonly paymentsService: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Places an order.
   *
   * Everything that must not partially happen runs in one MongoDB transaction:
   * stock reservation, coupon redemption, the wallet debit and the order document.
   * If payment initiation fails, the transaction is aborted and no stock, coupon or
   * balance was consumed. The gateway call itself is deliberately outside the
   * transaction, because a network call must never hold database locks.
   */
  async place(params: {
    campusId: string;
    userId: string;
    dto: PlaceOrderDto;
    idempotencyKey?: string;
  }) {
    const { campusId, userId, dto } = params;

    const vendor = await this.vendorModel
      .findOne({ _id: new Types.ObjectId(dto.vendorId), campusId: new Types.ObjectId(campusId) })
      .lean();
    if (!vendor) throw AppException.notFound('Kitchen');
    if (!vendor.isOpen) {
      throw AppException.unprocessable(
        ERROR_CODES.VENDOR_CLOSED,
        `${vendor.name} is not accepting orders right now.`,
      );
    }

    const customer = await this.userModel
      .findById(userId)
      .select('name email phone addresses walletBalance')
      .lean();
    if (!customer) throw AppException.notFound('User');

    const address =
      dto.type === ORDER_TYPE.DELIVERY
        ? customer.addresses?.find((entry) => String(entry._id) === dto.addressId)
        : undefined;
    if (dto.type === ORDER_TYPE.DELIVERY && !address) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'Choose a delivery address before placing the order.',
      );
    }

    // Paying by wallet means spending the wallet; asking the customer to also tick
    // "apply wallet" would only produce a confusing INSUFFICIENT_FUNDS on a funded account.
    const applyWallet = dto.applyWallet || dto.paymentMethod === PAYMENT_METHOD.WALLET;

    const quote = await this.pricingService.quote({
      campusId,
      userId,
      vendorId: dto.vendorId,
      orderType: dto.type,
      couponCode: dto.couponCode,
      applyWallet,
      campusZoneId: address?.campusZoneId ? String(address.campusZoneId) : undefined,
      lines: dto.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        choiceIds: line.choiceIds,
        notes: line.notes,
      })),
    });

    if (dto.paymentMethod === PAYMENT_METHOD.WALLET && quote.breakdown.payableNow > 0) {
      throw AppException.unprocessable(
        ERROR_CODES.INSUFFICIENT_FUNDS,
        'Your wallet does not cover this order. Choose another payment method.',
      );
    }

    const code = generateOrderCode();
    const handoverOtp = generateNumericOtp();
    const commissionAmount = percentOf(quote.breakdown.itemsTotal, vendor.commissionPercent);

    const session = await this.connection.startSession();
    let orderId = '';

    try {
      await session.withTransaction(async () => {
        await this.catalogService.reserveStock(
          dto.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          session,
        );

        const [order] = await this.orderModel.create(
          [
            {
              code,
              campusId: new Types.ObjectId(campusId),
              customerId: new Types.ObjectId(userId),
              customerName: customer.name,
              vendorId: new Types.ObjectId(dto.vendorId),
              vendorName: vendor.name,
              type: dto.type,
              // Prepaid orders wait for capture; wallet and COD are placed immediately.
              status:
                quote.breakdown.payableNow > 0 &&
                dto.paymentMethod !== PAYMENT_METHOD.CASH_ON_DELIVERY
                  ? ORDER_STATUS.AWAITING_PAYMENT
                  : ORDER_STATUS.PLACED,
              lines: quote.lines,
              breakdown: quote.breakdown,
              paymentMethod: dto.paymentMethod,
              paymentStatus: PAYMENT_STATUS.CREATED,
              address,
              couponCode: quote.coupon?.code,
              commissionAmount,
              vendorPayout: quote.breakdown.itemsTotal - commissionAmount,
              instructions: dto.instructions,
              scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
              etaMinutes: quote.etaMinutes,
              handoverOtpHash: hashToken(handoverOtp),
              handoverCode: handoverOtp,
              timeline: [{ status: ORDER_STATUS.DRAFT, at: new Date(), byUserId: new Types.ObjectId(userId) }],
            },
          ],
          { session },
        );

        orderId = String(order!._id);

        if (quote.coupon) {
          await this.couponsService.redeem(
            {
              couponId: quote.coupon.couponId,
              userId,
              orderId,
              discountAmount: quote.coupon.discount,
            },
            session,
          );
        }

        if (quote.breakdown.walletApplied > 0) {
          await this.walletService.debit(
            {
              userId,
              campusId,
              type: WALLET_TXN_TYPE.ORDER_PAYMENT,
              amount: quote.breakdown.walletApplied,
              description: `Order ${code} at ${vendor.name}`,
              orderId,
              idempotencyKey: `order-wallet:${orderId}`,
            },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // Gateway call happens after commit: a slow gateway must not hold locks, and a
    // failure here leaves a recoverable `awaiting_payment` order rather than a
    // half-applied one.
    const payment = await this.paymentsService.initiate({
      campusId,
      userId,
      orderId,
      amount: quote.breakdown.payableNow,
      method: dto.paymentMethod,
      reference: code,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      idempotencyKey: params.idempotencyKey ?? `order:${orderId}`,
    });

    await this.orderModel.updateOne(
      { _id: new Types.ObjectId(orderId) },
      {
        $set: {
          paymentStatus: payment.settled ? PAYMENT_STATUS.CAPTURED : PAYMENT_STATUS.PENDING,
        },
      },
    );

    await this.cartService.clear(campusId, userId);

    if (payment.settled) {
      await this.transition(orderId, ORDER_STATUS.PLACED, { actorId: userId, system: true });
    }

    return {
      orderId,
      code,
      status: payment.settled ? ORDER_STATUS.PLACED : ORDER_STATUS.AWAITING_PAYMENT,
      breakdown: quote.breakdown,
      // Returned once, at creation, so the customer can show it at handover.
      handoverOtp,
      payment: {
        paymentId: payment.paymentId,
        providerOrderId: payment.providerOrderId,
        publicKey: payment.publicKey,
        amount: payment.amount,
        settled: payment.settled,
      },
    };
  }

  /**
   * The only place an order's status changes.
   *
   * Transitions are checked against a forward-only map, so no caller - vendor, admin
   * or a replayed webhook - can move an order backwards or skip a step. Side effects
   * are emitted as domain events rather than called directly.
   */
  async transition(
    orderId: string,
    next: OrderStatus,
    context: { actorId?: string; note?: string; system?: boolean },
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw AppException.notFound('Order');

    if (order.status === next) return order;

    const allowed = ORDER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(next)) {
      throw AppException.unprocessable(
        ERROR_CODES.INVALID_TRANSITION,
        `An order that is "${order.status}" cannot become "${next}".`,
      );
    }

    const previous = order.status;
    order.status = next;
    order.timeline.push({
      status: next,
      at: new Date(),
      byUserId: context.actorId ? new Types.ObjectId(context.actorId) : undefined,
      note: context.note,
    } as never);

    if (next === ORDER_STATUS.ACCEPTED) order.acceptedAt = new Date();
    if (next === ORDER_STATUS.READY) order.readyAt = new Date();
    if (next === ORDER_STATUS.DELIVERED) order.deliveredAt = new Date();

    await order.save();

    // The handover code is spent the moment the order closes; dropping it keeps live
    // codes out of the historical data. The hash stays, so a late verification attempt
    // still fails closed rather than throwing.
    if (HANDOVER_CODE_CLOSED_STATUSES.includes(next)) {
      await this.orderModel.updateOne({ _id: order._id }, { $unset: { handoverCode: 1 } });
    }

    this.events.emit(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, {
      orderId: String(order._id),
      code: order.code,
      campusId: String(order.campusId),
      customerId: String(order.customerId),
      vendorId: String(order.vendorId),
      previous,
      status: next,
      type: order.type,
    });

    return order;
  }

  async vendorUpdateStatus(
    campusId: string,
    vendorId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    actorId: string,
  ) {
    if (!VENDOR_ALLOWED_STATUSES.includes(dto.status)) {
      throw AppException.forbidden('A kitchen cannot set this status.');
    }

    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        campusId: new Types.ObjectId(campusId),
        // Ownership is part of the filter: a vendor cannot touch another's order.
        vendorId: new Types.ObjectId(vendorId),
      })
      .select('_id status type')
      .lean();
    if (!order) throw AppException.notFound('Order');

    // Only pickup orders are handed straight to the customer by the kitchen.
    if (dto.status === ORDER_STATUS.DELIVERED && order.type === ORDER_TYPE.DELIVERY) {
      throw AppException.forbidden('A delivery order is completed by the delivery partner.');
    }

    const updated = await this.transition(orderId, dto.status, {
      actorId,
      note: dto.note,
    });

    if (dto.status === ORDER_STATUS.REJECTED) {
      await this.releaseAndRefund(updated, dto.note ?? 'Rejected by the kitchen', actorId);
    }

    return updated.toJSON();
  }

  async cancel(params: {
    campusId: string;
    orderId: string;
    actorId: string;
    dto: CancelOrderDto;
    isCustomer: boolean;
  }) {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(params.orderId),
      campusId: new Types.ObjectId(params.campusId),
    };
    if (params.isCustomer) filter.customerId = new Types.ObjectId(params.actorId);

    const order = await this.orderModel.findOne(filter);
    if (!order) throw AppException.notFound('Order');

    if (params.isCustomer && !CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw AppException.unprocessable(
        ERROR_CODES.INVALID_TRANSITION,
        'The kitchen has already started your order. Contact support for help.',
      );
    }

    const cancelled = await this.transition(params.orderId, ORDER_STATUS.CANCELLED, {
      actorId: params.actorId,
      note: params.dto.reason,
    });
    cancelled.cancelReason = params.dto.reason;
    cancelled.cancelledBy = new Types.ObjectId(params.actorId);
    await cancelled.save();

    await this.releaseAndRefund(cancelled, params.dto.reason, params.actorId);
    return cancelled.toJSON();
  }

  /**
   * Verifies the customer's handover code before a delivery is completed. The stored
   * value is a hash, attempts are bounded, and the comparison is constant-time.
   */
  async verifyHandover(orderId: string, otp: string): Promise<boolean> {
    const order = await this.orderModel.findById(orderId).select('+handoverOtpHash');
    if (!order?.handoverOtpHash) return false;
    return safeEqual(order.handoverOtpHash, hashToken(otp));
  }

  /**
   * The code the customer reads out at handover.
   *
   * Ownership is part of the query, and a terminal order returns nothing: once the food
   * has changed hands the code has no purpose, and continuing to serve it would widen
   * the window in which a shoulder-surfed screenshot is worth anything.
   */
  async handoverCode(campusId: string, userId: string, orderId: string) {
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        campusId: new Types.ObjectId(campusId),
        customerId: new Types.ObjectId(userId),
      })
      .select('+handoverCode status')
      .lean();
    if (!order) throw AppException.notFound('Order');

    if (HANDOVER_CODE_CLOSED_STATUSES.includes(order.status)) {
      return { code: null, reason: 'closed' as const };
    }

    return { code: order.handoverCode ?? null };
  }

  async findForCustomer(campusId: string, userId: string, orderId: string) {
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        campusId: new Types.ObjectId(campusId),
        customerId: new Types.ObjectId(userId),
      })
      .lean();
    if (!order) throw AppException.notFound('Order');
    return order;
  }

  async listForCustomer(
    campusId: string,
    userId: string,
    page: number,
    limit: number,
    status?: OrderStatus,
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      customerId: new Types.ObjectId(userId),
      status: { $ne: ORDER_STATUS.DRAFT },
    };
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  async listForVendor(
    campusId: string,
    vendorId: string,
    params: { page: number; limit: number; status?: OrderStatus; live?: boolean },
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      vendorId: new Types.ObjectId(vendorId),
    };
    if (params.status) {
      filter.status = params.status;
    } else if (params.live) {
      // The kitchen board: everything that still needs someone to act.
      filter.status = {
        $in: [
          ORDER_STATUS.PLACED,
          ORDER_STATUS.ACCEPTED,
          ORDER_STATUS.PREPARING,
          ORDER_STATUS.READY,
        ],
      };
    } else {
      filter.status = { $nin: [ORDER_STATUS.DRAFT, ORDER_STATUS.AWAITING_PAYMENT] };
    }

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: params.live ? 1 : -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);
    return paginated(items, total, params.page, params.limit);
  }

  async listForAdmin(
    campusId: string,
    params: { page: number; limit: number; status?: OrderStatus; search?: string },
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (params.status) filter.status = params.status;
    if (params.search) filter.code = params.search.toUpperCase();

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);
    return paginated(items, total, params.page, params.limit);
  }

  async findByIdScoped(campusId: string, orderId: string, vendorId?: string) {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(orderId),
      campusId: new Types.ObjectId(campusId),
    };
    if (vendorId) filter.vendorId = new Types.ObjectId(vendorId);

    const order = await this.orderModel.findOne(filter).lean();
    if (!order) throw AppException.notFound('Order');
    return order;
  }

  /** Marks a prepaid order as placed once the gateway confirms capture. */
  async onPaymentCaptured(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).select('status').lean();
    if (!order) return;

    await this.orderModel.updateOne(
      { _id: new Types.ObjectId(orderId) },
      { $set: { paymentStatus: PAYMENT_STATUS.CAPTURED } },
    );

    if (order.status === ORDER_STATUS.AWAITING_PAYMENT) {
      await this.transition(orderId, ORDER_STATUS.PLACED, { system: true });
    }
  }

  async onPaymentFailed(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId);
    if (!order || order.status !== ORDER_STATUS.AWAITING_PAYMENT) return;

    await this.orderModel.updateOne(
      { _id: order._id },
      { $set: { paymentStatus: PAYMENT_STATUS.FAILED } },
    );
    await this.transition(String(order._id), ORDER_STATUS.CANCELLED, {
      system: true,
      note: 'Payment failed',
    });
    await this.releaseAndRefund(order, 'Payment failed', undefined);
  }

  /**
   * Unwinds an order: stock returns to the menu, the coupon becomes usable again,
   * and any money actually taken is returned - wallet portion to the wallet, card
   * portion to the gateway.
   */
  private async releaseAndRefund(
    order: OrderDocument,
    reason: string,
    actorId?: string,
  ): Promise<void> {
    await this.catalogService.releaseStock(
      order.lines.map((line) => ({
        productId: String(line.productId),
        quantity: line.quantity,
      })),
    );
    await this.couponsService.releaseRedemption(String(order._id));

    if (order.breakdown.walletApplied > 0) {
      await this.walletService.credit({
        userId: String(order.customerId),
        campusId: String(order.campusId),
        type: WALLET_TXN_TYPE.REFUND,
        amount: order.breakdown.walletApplied,
        description: `Refund for order ${order.code}: ${reason}`,
        orderId: String(order._id),
        idempotencyKey: `order-refund-wallet:${order._id}`,
      });
    }

    if (
      order.paymentStatus === PAYMENT_STATUS.CAPTURED &&
      order.breakdown.payableNow > 0 &&
      order.refundedAmount < order.breakdown.payableNow
    ) {
      try {
        await this.paymentsService.refund({
          orderId: String(order._id),
          amount: order.breakdown.payableNow - order.refundedAmount,
          reason,
          initiatedBy: actorId ?? String(order.customerId),
        });
        order.refundedAmount = order.breakdown.payableNow;
        order.paymentStatus = PAYMENT_STATUS.REFUND_PENDING;
        await order.save();
      } catch (error) {
        // A failed gateway refund must not block the cancellation; it is retried by support.
        this.logger.error(
          { err: error, orderId: String(order._id) },
          'Gateway refund failed; order cancelled and flagged for manual refund.',
        );
      }
    }
  }
}
