import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import {
  DELIVERY_STATUS,
  DOMAIN_EVENTS,
  ERROR_CODES,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  WALLET_TXN_TYPE,
  WS_EVENTS,
  formatMoney,
  type DeliveryStatus,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { hashToken, safeEqual } from '@/common/utils/crypto.util';
import { paginated } from '@/common/utils/pagination.util';
import {
  DeliveryAssignment,
  DeliveryProfile,
  Order,
  User,
  Vendor,
  type DeliveryAssignmentDocument,
  type DeliveryProfileDocument,
  type OrderDocument,
  type UserDocument,
  type VendorDocument,
} from '@/database/schemas';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { SettingsService } from '@/modules/platform/settings.service';
import { WalletService } from '@/modules/wallet/wallet.service';

const MAX_OTP_ATTEMPTS = 5;

/**
 * Delivery dispatch and the partner's job lifecycle.
 *
 * This module never calls the order state machine directly - it emits
 * `delivery.status_changed` and the orders listener advances the order. That keeps
 * the two modules independent and leaves one owner for order status.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectModel(DeliveryAssignment.name)
    private readonly assignmentModel: Model<DeliveryAssignmentDocument>,
    @InjectModel(DeliveryProfile.name)
    private readonly profileModel: Model<DeliveryProfileDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly walletService: WalletService,
    private readonly settingsService: SettingsService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Creates the job when an order is ready and broadcasts it to online partners.
   * Idempotent: the unique index on `orderId` means a repeated event cannot create
   * two jobs for one order.
   */
  async createAssignmentForOrder(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).lean();
    if (!order) return;

    const existing = await this.assignmentModel.findOne({ orderId: order._id }).lean();
    if (existing) return;

    const vendor = await this.vendorModel
      .findById(order.vendorId)
      .select('name location contactPhone')
      .lean();

    const earning = await this.settingsService.getNumber(
      String(order.campusId),
      'delivery',
      'partnerEarningPaise',
      2_000,
    );

    const assignment = await this.assignmentModel.create({
      campusId: order.campusId,
      orderId: order._id,
      orderCode: order.code,
      status: DELIVERY_STATUS.UNASSIGNED,
      pickup: {
        name: vendor?.name ?? 'Kitchen',
        address: vendor?.name ?? 'Campus kitchen',
        phone: vendor?.contactPhone,
        location: vendor?.location,
      },
      drop: {
        name: order.address?.contactName ?? order.customerName ?? 'Customer',
        address: [order.address?.hostel, order.address?.roomNumber, order.address?.line1]
          .filter(Boolean)
          .join(', '),
        area: order.address?.hostel ?? order.address?.line1 ?? 'Campus',
        phone: order.address?.contactPhone,
        location: order.address?.location,
      },
      earning,
      // `payableNow` already has any wallet credit taken off, so this is the cash the
      // student actually owes at the door.
      collectCash:
        order.paymentMethod === PAYMENT_METHOD.CASH_ON_DELIVERY &&
        order.paymentStatus !== PAYMENT_STATUS.CAPTURED
          ? order.breakdown.payableNow
          : 0,
      itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
      offeredAt: new Date(),
    });

    await this.orderModel.updateOne(
      { _id: order._id },
      { $set: { deliveryAssignmentId: assignment._id } },
    );

    // Broadcast to the pool: whoever accepts first gets it.
    this.gateway.emitToCampusDelivery(String(order.campusId), WS_EVENTS.DELIVERY_OFFER, {
      assignmentId: String(assignment._id),
      orderCode: order.code,
      pickup: assignment.pickup.name,
      // The area, not the address: the pool is a broadcast, and the room number is only
      // for whoever actually takes the job.
      drop: assignment.drop.area ?? 'Campus',
      earning,
      collectCash: assignment.collectCash,
    });

    await this.notifyOnlinePartners(String(order.campusId), assignment);
  }

  async availableJobs(campusId: string, partnerId: string) {
    const profile = await this.requireProfile(campusId, partnerId);
    if (!profile.isOnline) return { items: [], reason: 'offline' };

    const open = await this.assignmentModel
      .find({
        campusId: new Types.ObjectId(campusId),
        // `offered` is the pool after we have pinged online riders. Listing only
        // `unassigned` hid every job the moment a partner was online to receive it.
        status: { $in: [DELIVERY_STATUS.UNASSIGNED, DELIVERY_STATUS.OFFERED] },
        // Never re-offer a job this partner already declined.
        declinedBy: { $ne: new Types.ObjectId(partnerId) },
      })
      // The projection is the privacy boundary: the customer's name, phone and room are
      // not read at all for a job nobody has accepted yet.
      .select('orderCode pickup drop.area earning collectCash itemCount distanceMeters offeredAt')
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    const items = open.map((assignment) => ({
      id: String(assignment._id),
      orderCode: assignment.orderCode,
      pickup: {
        name: assignment.pickup.name,
        address: assignment.pickup.address,
        location: assignment.pickup.location,
      },
      dropArea: assignment.drop?.area ?? 'Campus',
      earning: assignment.earning,
      collectCash: assignment.collectCash,
      itemCount: assignment.itemCount,
      distanceMeters: assignment.distanceMeters,
      offeredAt: assignment.offeredAt,
    }));

    return { items };
  }

  async myJobs(campusId: string, partnerId: string, page: number, limit: number, active = false) {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      partnerId: new Types.ObjectId(partnerId),
    };
    filter.status = active
      ? {
          $in: [
            DELIVERY_STATUS.ASSIGNED,
            DELIVERY_STATUS.ARRIVED_AT_VENDOR,
            DELIVERY_STATUS.PICKED_UP,
            DELIVERY_STATUS.ARRIVED_AT_CUSTOMER,
          ],
        }
      : { $in: [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.FAILED, DELIVERY_STATUS.CANCELLED] };

    const [items, total] = await Promise.all([
      this.assignmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.assignmentModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  /**
   * Claims a job. The conditional update is the race winner: only the request that
   * finds the assignment still unassigned succeeds, so two partners tapping "accept"
   * at once cannot both get it.
   */
  async accept(campusId: string, partnerId: string, assignmentId: string) {
    const profile = await this.requireProfile(campusId, partnerId);
    if (!profile.isOnline) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        'Go online before accepting deliveries.',
      );
    }
    if (profile.activeOrderCount >= profile.maxConcurrentOrders) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        'You are already carrying the maximum number of orders.',
      );
    }

    const assignment = await this.assignmentModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(assignmentId),
        campusId: new Types.ObjectId(campusId),
        status: { $in: [DELIVERY_STATUS.UNASSIGNED, DELIVERY_STATUS.OFFERED] },
        partnerId: { $exists: false },
      },
      {
        $set: {
          partnerId: new Types.ObjectId(partnerId),
          status: DELIVERY_STATUS.ASSIGNED,
          acceptedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!assignment) {
      throw AppException.conflict('Another partner has already taken this delivery.');
    }

    await this.profileModel.updateOne(
      { userId: new Types.ObjectId(partnerId) },
      { $inc: { activeOrderCount: 1 } },
    );

    const order = await this.orderModel
      .findById(assignment.orderId)
      .select('customerId code')
      .lean();
    if (order) {
      await this.notificationsService.notify({
        userId: String(order.customerId),
        campusId,
        type: NOTIFICATION_TYPE.ORDER_OUT_FOR_DELIVERY,
        title: 'A delivery partner is on the way',
        body: `Your order ${order.code} has been picked up for delivery.`,
        deepLink: `/orders/${String(assignment.orderId)}`,
        collapseKey: `order:${String(assignment.orderId)}`,
      });
    }

    return assignment.toJSON();
  }

  async decline(campusId: string, partnerId: string, assignmentId: string) {
    await this.assignmentModel.updateOne(
      {
        _id: new Types.ObjectId(assignmentId),
        campusId: new Types.ObjectId(campusId),
        status: { $in: [DELIVERY_STATUS.UNASSIGNED, DELIVERY_STATUS.OFFERED] },
      },
      { $addToSet: { declinedBy: new Types.ObjectId(partnerId) } },
    );
    return { declined: true };
  }

  /**
   * Advances a job. `delivered` is gated on the customer's handover code, which is
   * what prevents a partner from marking food delivered while keeping it, and OTP
   * attempts are capped so the six-digit code cannot be brute-forced.
   */
  async updateStatus(params: {
    campusId: string;
    partnerId: string;
    assignmentId: string;
    status: DeliveryStatus;
    otp?: string;
    location?: [number, number];
    failureReason?: string;
  }) {
    const assignment = await this.assignmentModel.findOne({
      _id: new Types.ObjectId(params.assignmentId),
      campusId: new Types.ObjectId(params.campusId),
      partnerId: new Types.ObjectId(params.partnerId),
    });
    if (!assignment) throw AppException.notFound('Delivery');

    const allowed: Record<string, DeliveryStatus[]> = {
      [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.ARRIVED_AT_VENDOR, DELIVERY_STATUS.FAILED],
      [DELIVERY_STATUS.ARRIVED_AT_VENDOR]: [DELIVERY_STATUS.PICKED_UP, DELIVERY_STATUS.FAILED],
      [DELIVERY_STATUS.PICKED_UP]: [
        DELIVERY_STATUS.ARRIVED_AT_CUSTOMER,
        DELIVERY_STATUS.DELIVERED,
        DELIVERY_STATUS.FAILED,
      ],
      [DELIVERY_STATUS.ARRIVED_AT_CUSTOMER]: [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.FAILED],
    };

    if (!allowed[assignment.status]?.includes(params.status)) {
      throw AppException.unprocessable(
        ERROR_CODES.INVALID_TRANSITION,
        `A delivery that is "${assignment.status}" cannot become "${params.status}".`,
      );
    }

    if (params.status === DELIVERY_STATUS.DELIVERED) {
      if (assignment.otpAttempts >= MAX_OTP_ATTEMPTS) {
        throw AppException.forbidden(
          'Too many incorrect handover codes. Contact support to complete this delivery.',
        );
      }
      const valid = params.otp
        ? await this.verifyHandoverOtp(String(assignment.orderId), params.otp)
        : false;
      if (!valid) {
        assignment.otpAttempts += 1;
        await assignment.save();
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          'That handover code is not correct. Ask the customer to read it again.',
        );
      }
    }

    assignment.status = params.status;
    if (params.location) {
      assignment.lastKnownLocation = { type: 'Point', coordinates: params.location };
      assignment.lastLocationAt = new Date();
    }
    if (params.status === DELIVERY_STATUS.ARRIVED_AT_VENDOR) {
      assignment.arrivedAtVendorAt = new Date();
    }
    if (params.status === DELIVERY_STATUS.PICKED_UP) assignment.pickedUpAt = new Date();
    if (params.status === DELIVERY_STATUS.DELIVERED) assignment.deliveredAt = new Date();
    if (params.status === DELIVERY_STATUS.FAILED && params.failureReason) {
      // Kept for the admin who has to decide on a refund, and for the partner's record
      // if a pattern of failures shows up later.
      assignment.failureReason = params.failureReason;
    }
    await assignment.save();

    // The orders module listens and moves the order forward.
    this.events.emit(DOMAIN_EVENTS.DELIVERY_STATUS_CHANGED, {
      assignmentId: String(assignment._id),
      orderId: String(assignment.orderId),
      campusId: params.campusId,
      partnerId: params.partnerId,
      status: params.status,
      orderStatus: this.mapToOrderStatus(params.status),
    });

    this.gateway.emitToOrder(String(assignment.orderId), WS_EVENTS.DELIVERY_UPDATED, {
      assignmentId: String(assignment._id),
      status: params.status,
    });

    if (params.status === DELIVERY_STATUS.DELIVERED) {
      await this.settleEarning(assignment);
    }

    return assignment.toJSON();
  }

  async setOnline(campusId: string, partnerId: string, isOnline: boolean) {
    const profile = await this.requireProfile(campusId, partnerId);
    profile.isOnline = isOnline;
    await profile.save();
    return { isOnline };
  }

  async updateLocation(campusId: string, partnerId: string, coordinates: [number, number]) {
    await this.profileModel.updateOne(
      { userId: new Types.ObjectId(partnerId), campusId: new Types.ObjectId(campusId) },
      { $set: { location: { type: 'Point', coordinates } } },
    );
    return { updated: true };
  }

  async earnings(campusId: string, partnerId: string) {
    const profile = await this.requireProfile(campusId, partnerId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayAgg] = await this.assignmentModel.aggregate<{ total: number; count: number }>([
      {
        $match: {
          partnerId: new Types.ObjectId(partnerId),
          status: DELIVERY_STATUS.DELIVERED,
          deliveredAt: { $gte: todayStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$earning' }, count: { $sum: 1 } } },
    ]);

    return {
      today: { amount: todayAgg?.total ?? 0, deliveries: todayAgg?.count ?? 0 },
      lifetime: profile.lifetimeEarnings,
      unsettled: profile.unsettledEarnings,
      completedDeliveries: profile.completedDeliveries,
      rating: profile.rating,
      isOnline: profile.isOnline,
    };
  }

  /** Admin override for a stuck delivery. */
  async assignManually(campusId: string, assignmentId: string, partnerId: string) {
    const profile = await this.profileModel.findOne({
      userId: new Types.ObjectId(partnerId),
      campusId: new Types.ObjectId(campusId),
    });
    if (!profile) throw AppException.notFound('Delivery partner');

    const assignment = await this.assignmentModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(assignmentId),
        campusId: new Types.ObjectId(campusId),
        status: { $in: [DELIVERY_STATUS.UNASSIGNED, DELIVERY_STATUS.OFFERED] },
      },
      {
        $set: {
          partnerId: new Types.ObjectId(partnerId),
          status: DELIVERY_STATUS.ASSIGNED,
          acceptedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!assignment) throw AppException.conflict('This delivery can no longer be assigned.');

    await this.profileModel.updateOne({ _id: profile._id }, { $inc: { activeOrderCount: 1 } });
    await this.notificationsService.notify({
      userId: partnerId,
      campusId,
      type: NOTIFICATION_TYPE.DELIVERY_ASSIGNED,
      title: 'Delivery assigned to you',
      body: `Order ${assignment.orderCode} · ${formatMoney(assignment.earning)}`,
      deepLink: '/',
    });

    return assignment.toJSON();
  }

  async listForAdmin(campusId: string, page: number, limit: number, status?: DeliveryStatus) {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      this.assignmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.assignmentModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  private async settleEarning(assignment: DeliveryAssignmentDocument): Promise<void> {
    if (!assignment.partnerId) return;

    await this.profileModel.updateOne(
      { userId: assignment.partnerId },
      {
        $inc: {
          activeOrderCount: -1,
          completedDeliveries: 1,
          lifetimeEarnings: assignment.earning,
        },
      },
    );

    await this.walletService.credit({
      userId: String(assignment.partnerId),
      campusId: String(assignment.campusId),
      type: WALLET_TXN_TYPE.DELIVERY_EARNING,
      amount: assignment.earning,
      description: `Delivery earning for ${assignment.orderCode}`,
      orderId: String(assignment.orderId),
      // Keyed by assignment so a replayed event cannot pay twice.
      idempotencyKey: `delivery-earning:${assignment._id}`,
    });
  }

  private async notifyOnlinePartners(
    campusId: string,
    assignment: DeliveryAssignmentDocument,
  ): Promise<void> {
    const online = await this.profileModel
      .find({
        campusId: new Types.ObjectId(campusId),
        isOnline: true,
        $expr: { $lt: ['$activeOrderCount', '$maxConcurrentOrders'] },
      })
      .select('userId')
      .limit(25)
      .lean();

    if (!online.length) {
      this.logger.warn(`No online delivery partners for campus ${campusId}.`);
      return;
    }

    await this.notificationsService.notifyMany(
      online.map((profile) => String(profile.userId)),
      {
        campusId,
        type: NOTIFICATION_TYPE.DELIVERY_OFFERED,
        title: 'New delivery available',
        body: `${assignment.pickup.name} → ${assignment.drop.area ?? 'Campus'} · ${formatMoney(assignment.earning)}`,
        deepLink: '/jobs',
        data: { assignmentId: String(assignment._id) },
      },
    );

    await this.assignmentModel.updateOne(
      { _id: assignment._id },
      {
        $set: { status: DELIVERY_STATUS.OFFERED },
        $addToSet: { offeredTo: { $each: online.map((profile) => profile.userId) } },
      },
    );
  }

  private async verifyHandoverOtp(orderId: string, otp: string): Promise<boolean> {
    const order = await this.orderModel.findById(orderId).select('+handoverOtpHash');
    if (!order?.handoverOtpHash) return false;
    return safeEqual(order.handoverOtpHash, hashToken(otp));
  }

  private mapToOrderStatus(status: DeliveryStatus): string | undefined {
    switch (status) {
      case DELIVERY_STATUS.PICKED_UP:
        return ORDER_STATUS.OUT_FOR_DELIVERY;
      case DELIVERY_STATUS.DELIVERED:
        return ORDER_STATUS.DELIVERED;
      default:
        return undefined;
    }
  }

  private async requireProfile(
    campusId: string,
    partnerId: string,
  ): Promise<DeliveryProfileDocument> {
    const existing = await this.profileModel.findOne({
      userId: new Types.ObjectId(partnerId),
      campusId: new Types.ObjectId(campusId),
    });
    if (existing) return existing;

    const user = await this.userModel.findById(partnerId).select('_id').lean();
    if (!user) throw AppException.notFound('User');

    return this.profileModel.create({
      userId: new Types.ObjectId(partnerId),
      campusId: new Types.ObjectId(campusId),
    });
  }
}
