import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import {
  DOMAIN_EVENTS,
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  ORDER_TYPE,
  WS_EVENTS,
  formatMoney,
  type NotificationType,
  type OrderStatus,
  type OrderType,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { Order, Vendor, type OrderDocument, type VendorDocument } from '@/database/schemas';
import { mailTemplates } from '@/modules/mail/mail.templates';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { DeliveryService } from '@/modules/delivery/delivery.service';
import { OrdersService } from './orders.service';

interface StatusChangedEvent {
  orderId: string;
  code: string;
  campusId: string;
  customerId: string;
  vendorId: string;
  previous: OrderStatus;
  status: OrderStatus;
  type: OrderType;
}

/** What the customer is told at each step. */
const CUSTOMER_MESSAGES: Partial<
  Record<OrderStatus, { type: NotificationType; title: string; body: (code: string, vendor: string) => string }>
> = {
  [ORDER_STATUS.PLACED]: {
    type: NOTIFICATION_TYPE.ORDER_PLACED,
    title: 'Order placed',
    body: (code, vendor) => `${vendor} has received your order ${code}.`,
  },
  [ORDER_STATUS.ACCEPTED]: {
    type: NOTIFICATION_TYPE.ORDER_ACCEPTED,
    title: 'Order accepted',
    body: (code, vendor) => `${vendor} accepted ${code} and will start cooking shortly.`,
  },
  [ORDER_STATUS.PREPARING]: {
    type: NOTIFICATION_TYPE.ORDER_PREPARING,
    title: 'Your food is being prepared',
    body: (code, vendor) => `${vendor} is preparing ${code} right now.`,
  },
  [ORDER_STATUS.READY]: {
    type: NOTIFICATION_TYPE.ORDER_READY,
    title: 'Order ready',
    body: (code) => `${code} is ready. Show your handover code at pickup.`,
  },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: {
    type: NOTIFICATION_TYPE.ORDER_OUT_FOR_DELIVERY,
    title: 'On the way',
    body: (code) => `${code} is out for delivery.`,
  },
  [ORDER_STATUS.DELIVERED]: {
    type: NOTIFICATION_TYPE.ORDER_DELIVERED,
    title: 'Delivered - enjoy!',
    body: (code) => `${code} has been delivered. Tap to rate your meal.`,
  },
  [ORDER_STATUS.REJECTED]: {
    type: NOTIFICATION_TYPE.ORDER_REJECTED,
    title: 'Order could not be accepted',
    body: (code, vendor) => `${vendor} could not accept ${code}. Any payment is being refunded.`,
  },
  [ORDER_STATUS.CANCELLED]: {
    type: NOTIFICATION_TYPE.ORDER_CANCELLED,
    title: 'Order cancelled',
    body: (code) => `${code} was cancelled. Any payment is being refunded.`,
  },
};

/**
 * The fan-out point.
 *
 * `OrdersService` emits one event; this listener decides who hears about it and how -
 * customer push, vendor board, delivery dispatch, admin console, receipt email. Adding
 * an audience means adding a handler here, not editing the order state machine.
 */
@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly deliveryService: DeliveryService,
    private readonly ordersService: OrdersService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, { async: true })
  async onStatusChanged(event: StatusChangedEvent): Promise<void> {
    try {
      const order = await this.orderModel.findById(event.orderId).lean();
      if (!order) return;

      // 1. Live screens first - anything already open updates without a reload.
      this.gateway.emitToUser(event.customerId, WS_EVENTS.ORDER_UPDATED, {
        orderId: event.orderId,
        status: event.status,
        code: event.code,
      });
      this.gateway.emitToOrder(event.orderId, WS_EVENTS.ORDER_UPDATED, {
        orderId: event.orderId,
        status: event.status,
      });
      this.gateway.emitToVendor(
        event.vendorId,
        event.status === ORDER_STATUS.PLACED ? WS_EVENTS.ORDER_NEW : WS_EVENTS.ORDER_UPDATED,
        { orderId: event.orderId, code: event.code, status: event.status, order },
      );
      this.gateway.emitToCampusAdmins(event.campusId, WS_EVENTS.ORDER_UPDATED, {
        orderId: event.orderId,
        code: event.code,
        status: event.status,
      });

      // 2. The customer's notification, which also lands in their in-app centre.
      const message = CUSTOMER_MESSAGES[event.status];
      if (message) {
        await this.notificationsService.notify({
          userId: event.customerId,
          campusId: event.campusId,
          type: message.type,
          title: message.title,
          body: message.body(event.code, order.vendorName ?? 'The kitchen'),
          deepLink: `/orders/${event.orderId}`,
          data: { orderId: event.orderId, code: event.code, status: event.status },
          // One notification per order replaces the previous one on the lock screen.
          collapseKey: `order:${event.orderId}`,
          email:
            event.status === ORDER_STATUS.PLACED
              ? mailTemplates.orderReceipt({
                  name: order.customerName ?? 'there',
                  orderCode: order.code,
                  vendorName: order.vendorName ?? 'the kitchen',
                  total: formatMoney(order.breakdown.grandTotal),
                  lines: order.lines.map((line) => ({
                    name: line.name,
                    quantity: line.quantity,
                    amount: formatMoney(line.lineTotal),
                  })),
                })
              : undefined,
        });
      }

      // 3. The kitchen needs a loud alert for a new order, quiet updates otherwise.
      if (event.status === ORDER_STATUS.PLACED) {
        await this.notifyVendorStaff(event, order);
      }

      // 4. Dispatch: a ready delivery order needs a partner.
      if (event.status === ORDER_STATUS.READY && event.type === ORDER_TYPE.DELIVERY) {
        await this.deliveryService.createAssignmentForOrder(event.orderId);
      }

      // 5. Ask for a rating a little after the food arrives.
      if (event.status === ORDER_STATUS.DELIVERED) {
        await this.notificationsService.notify({
          userId: event.customerId,
          campusId: event.campusId,
          type: NOTIFICATION_TYPE.REVIEW_REMINDER,
          title: 'How was your meal?',
          body: `Rate your order from ${order.vendorName ?? 'the kitchen'} in a couple of taps.`,
          deepLink: `/orders/${event.orderId}/review`,
        });
      }
    } catch (error) {
      // A notification failure must never roll back a completed order transition.
      this.logger.error({ err: error, event }, 'Failed to fan out order status change');
    }
  }

  /**
   * The delivery module reports what the partner did; the order state machine stays
   * the single owner of order status.
   */
  @OnEvent(DOMAIN_EVENTS.DELIVERY_STATUS_CHANGED, { async: true })
  async onDeliveryStatusChanged(event: {
    orderId: string;
    partnerId?: string;
    orderStatus?: OrderStatus;
  }): Promise<void> {
    if (!event.orderStatus) return;
    try {
      await this.ordersService.transition(event.orderId, event.orderStatus, {
        actorId: event.partnerId,
        system: true,
      });
    } catch (error) {
      this.logger.warn(
        { err: error, event },
        'Delivery update could not advance the order status',
      );
    }
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_CAPTURED, { async: true })
  async onPaymentCaptured(event: { orderId: string }): Promise<void> {
    await this.ordersService.onPaymentCaptured(event.orderId);
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_FAILED, { async: true })
  async onPaymentFailed(event: { orderId: string }): Promise<void> {
    await this.ordersService.onPaymentFailed(event.orderId);
  }

  private async notifyVendorStaff(
    event: StatusChangedEvent,
    order: { code: string; breakdown: { grandTotal: number }; lines: Array<{ quantity: number }> },
  ): Promise<void> {
    const vendor = await this.vendorModel
      .findById(new Types.ObjectId(event.vendorId))
      .select('ownerId name')
      .lean();
    if (!vendor?.ownerId) return;

    const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    await this.notificationsService.notify({
      userId: String(vendor.ownerId),
      campusId: event.campusId,
      type: NOTIFICATION_TYPE.VENDOR_NEW_ORDER,
      title: `New order ${order.code}`,
      body: `${itemCount} item${itemCount > 1 ? 's' : ''} · ${formatMoney(order.breakdown.grandTotal)}`,
      deepLink: `/orders/${event.orderId}`,
      data: { orderId: event.orderId, code: order.code },
    });
  }
}
