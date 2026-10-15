import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ERROR_CODES, ORDER_TYPE, type Cart as CartView, type OrderType } from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { Cart, type CartDocument } from '@/database/schemas';
import { PricingService } from '@/modules/pricing/pricing.service';
import type { AddCartLineDto, UpdateCartLineDto } from './dto/cart.dto';

/**
 * A cart is single-vendor by design: one order goes to one kitchen, which keeps
 * pricing, prep time and delivery attribution unambiguous. Switching vendors clears
 * the cart, and the client is told explicitly rather than silently losing items.
 */
@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly pricingService: PricingService,
  ) {}

  async view(
    campusId: string,
    userId: string,
    orderType: OrderType = ORDER_TYPE.DELIVERY,
  ): Promise<CartView> {
    const cart = await this.getOrCreate(campusId, userId);
    return this.present(campusId, userId, cart, orderType);
  }

  async addLine(campusId: string, userId: string, dto: AddCartLineDto) {
    const cart = await this.getOrCreate(campusId, userId);

    if (cart.vendorId && String(cart.vendorId) !== dto.vendorId) {
      if (!dto.replaceCart) {
        throw AppException.conflict(
          'Your cart has items from another kitchen. Clear it to order from this one.',
        );
      }
      cart.lines = [];
      cart.couponCode = undefined;
    }

    cart.vendorId = new Types.ObjectId(dto.vendorId);

    // Identical product plus identical options collapses into one line.
    const signature = this.signature(dto.productId, dto.choiceIds ?? [], dto.notes);
    const existing = cart.lines.find(
      (line) =>
        this.signature(
          String(line.productId),
          line.options.map((option) => option.choiceId),
          line.notes,
        ) === signature,
    );

    if (existing) {
      existing.quantity = Math.min(50, existing.quantity + dto.quantity);
    } else {
      if (cart.lines.length >= 40) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          'A cart can hold at most 40 different items.',
        );
      }
      // Placeholder amounts: the priced values are written by `present` below.
      cart.lines.push({
        productId: new Types.ObjectId(dto.productId),
        name: 'pending',
        unitPrice: 0,
        quantity: dto.quantity,
        options: (dto.choiceIds ?? []).map((choiceId) => ({
          groupId: 'pending',
          groupName: 'pending',
          choiceId,
          choiceName: 'pending',
          priceDelta: 0,
        })),
        notes: dto.notes,
        lineTotal: 0,
      } as never);
    }

    cart.lastActivityAt = new Date();
    await cart.save();
    return this.present(campusId, userId, cart, dto.orderType ?? ORDER_TYPE.DELIVERY);
  }

  async updateLine(campusId: string, userId: string, lineId: string, dto: UpdateCartLineDto) {
    const cart = await this.getOrCreate(campusId, userId);
    const line = cart.lines.find((entry) => String((entry as { _id?: unknown })._id) === lineId);
    if (!line) throw AppException.notFound('Cart item');

    if (dto.quantity === 0) {
      cart.lines = cart.lines.filter(
        (entry) => String((entry as { _id?: unknown })._id) !== lineId,
      );
    } else {
      line.quantity = dto.quantity;
      if (dto.notes !== undefined) line.notes = dto.notes;
    }

    if (!cart.lines.length) {
      cart.vendorId = null;
      cart.couponCode = undefined;
    }
    cart.lastActivityAt = new Date();
    await cart.save();
    return this.present(campusId, userId, cart, dto.orderType ?? ORDER_TYPE.DELIVERY);
  }

  async applyCoupon(campusId: string, userId: string, code: string | undefined) {
    const cart = await this.getOrCreate(campusId, userId);
    if (!cart.vendorId) {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Your cart is empty.');
    }
    const previous = cart.couponCode;
    cart.couponCode = code?.toUpperCase();

    /**
     * Price the cart *before* persisting the code. Saving first would leave a rejected
     * coupon attached to the cart, and since every later cart read reprices with it,
     * the customer's cart would 422 on every request with no way back.
     */
    let view: CartView;
    try {
      view = await this.present(campusId, userId, cart, ORDER_TYPE.DELIVERY, {
        strictCoupon: true,
      });
    } catch (error) {
      cart.couponCode = previous;
      throw error;
    }

    await cart.save();
    return view;
  }

  async setWalletPreference(campusId: string, userId: string, applyWallet: boolean) {
    const cart = await this.getOrCreate(campusId, userId);
    cart.applyWallet = applyWallet;
    await cart.save();
    return this.present(campusId, userId, cart, ORDER_TYPE.DELIVERY);
  }

  async clear(campusId: string, userId: string) {
    await this.cartModel.updateOne(
      { userId: new Types.ObjectId(userId), campusId: new Types.ObjectId(campusId) },
      // `$set: { couponCode: undefined }` is silently dropped by Mongoose, which would
      // leave the coupon attached to an otherwise empty cart. `$unset` actually removes it.
      {
        $set: { lines: [], vendorId: null, applyWallet: false },
        $unset: { couponCode: '' },
      },
    );
    return { cleared: true };
  }

  async getRaw(campusId: string, userId: string): Promise<CartDocument> {
    return this.getOrCreate(campusId, userId);
  }

  private async getOrCreate(campusId: string, userId: string): Promise<CartDocument> {
    const existing = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
      campusId: new Types.ObjectId(campusId),
    });
    if (existing) return existing;

    return this.cartModel.create({
      userId: new Types.ObjectId(userId),
      campusId: new Types.ObjectId(campusId),
      lines: [],
    });
  }

  /**
   * Re-prices the cart on every read from the live catalogue, then persists the
   * priced lines. Stale prices therefore cannot survive in a cart across a menu
   * change, and the totals shown are the totals charged.
   */
  private async present(
    campusId: string,
    userId: string,
    cart: CartDocument,
    orderType: OrderType,
    options: { strictCoupon?: boolean } = {},
  ): Promise<CartView> {
    if (!cart.vendorId || !cart.lines.length) {
      return {
        id: String(cart._id),
        lines: [],
        breakdown: {
          itemsTotal: 0,
          packagingFee: 0,
          deliveryFee: 0,
          discount: 0,
          walletApplied: 0,
          taxTotal: 0,
          grandTotal: 0,
          payableNow: 0,
        },
        updatedAt: new Date().toISOString(),
      };
    }

    const priceCart = () =>
      this.pricingService.quote({
        campusId,
        userId,
        vendorId: String(cart.vendorId),
        orderType,
        couponCode: cart.couponCode,
        applyWallet: cart.applyWallet,
        lines: cart.lines.map((line) => ({
          productId: String(line.productId),
          quantity: line.quantity,
          choiceIds: line.options.map((option) => option.choiceId),
          notes: line.notes,
        })),
      });

    let quote;
    try {
      quote = await priceCart();
    } catch (error) {
      /**
       * A coupon can stop being valid while it sits in the cart - it expires, runs out
       * of redemptions, or the cart drops below its minimum. Failing the whole cart read
       * would strand the customer with an unusable cart, so the code is dropped and the
       * cart repriced. Applying a coupon is strict, because there the customer is
       * waiting to be told it did not work.
       */
      const isCouponProblem =
        error instanceof AppException && error.code === ERROR_CODES.COUPON_INVALID;
      if (options.strictCoupon || !isCouponProblem || !cart.couponCode) throw error;

      cart.couponCode = undefined;
      quote = await priceCart();
    }

    cart.lines.forEach((line, index) => {
      const priced = quote.lines[index];
      if (!priced) return;
      line.name = priced.name;
      line.imageUrl = priced.imageUrl;
      line.unitPrice = priced.unitPrice;
      line.options = priced.options as never;
      line.lineTotal = priced.lineTotal;
    });
    await cart.save();

    return {
      id: String(cart._id),
      vendorId: quote.vendorId,
      vendorName: quote.vendorName,
      couponCode: cart.couponCode,
      lines: cart.lines.map((line) => ({
        id: String((line as { _id?: unknown })._id),
        productId: String(line.productId),
        name: line.name,
        imageUrl: line.imageUrl,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        options: line.options,
        notes: line.notes,
        lineTotal: line.lineTotal,
      })),
      breakdown: quote.breakdown,
      updatedAt: new Date().toISOString(),
    };
  }

  private signature(productId: string, choiceIds: string[], notes?: string): string {
    return `${productId}|${[...choiceIds].sort().join(',')}|${notes ?? ''}`;
  }
}
