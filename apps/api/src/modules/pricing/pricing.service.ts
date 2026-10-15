import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  ORDER_TYPE,
  percentOf,
  type OrderType,
  type Paise,
  type PriceBreakdown,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import {
  Campus,
  Product,
  User,
  Vendor,
  type CampusDocument,
  type ProductDocument,
  type UserDocument,
  type VendorDocument,
} from '@/database/schemas';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { SettingsService } from '@/modules/platform/settings.service';

export interface RequestedLine {
  productId: string;
  quantity: number;
  /** Chosen option ids, validated against the product's own groups. */
  choiceIds?: string[];
  notes?: string;
}

export interface PricedLine {
  productId: Types.ObjectId;
  name: string;
  imageUrl?: string;
  unitPrice: Paise;
  quantity: number;
  options: Array<{
    groupId: string;
    groupName: string;
    choiceId: string;
    choiceName: string;
    priceDelta: Paise;
  }>;
  notes?: string;
  lineTotal: Paise;
}

export interface Quote {
  vendorId: string;
  vendorName: string;
  lines: PricedLine[];
  breakdown: PriceBreakdown;
  coupon?: { code: string; couponId: string; discount: Paise };
  etaMinutes: number;
}

export interface QuoteRequest {
  campusId: string;
  userId: string;
  vendorId: string;
  lines: RequestedLine[];
  orderType: OrderType;
  couponCode?: string;
  applyWallet?: boolean;
  campusZoneId?: string;
}

/**
 * The single authority on what an order costs.
 *
 * Both the cart preview and order placement call this, so the price a student sees
 * is produced by the same code that charges them. Nothing about money is ever taken
 * from the request body: quantities and option ids come from the client, every
 * amount is looked up server-side.
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Campus.name) private readonly campusModel: Model<CampusDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly couponsService: CouponsService,
    private readonly settingsService: SettingsService,
  ) {}

  async quote(request: QuoteRequest): Promise<Quote> {
    if (!request.lines.length) {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Your cart is empty.');
    }

    const vendor = await this.vendorModel
      .findOne({
        _id: new Types.ObjectId(request.vendorId),
        campusId: new Types.ObjectId(request.campusId),
      })
      .lean();
    if (!vendor) throw AppException.notFound('Kitchen');

    if (request.orderType === ORDER_TYPE.DELIVERY && !vendor.acceptsDelivery) {
      throw AppException.unprocessable(
        ERROR_CODES.VENDOR_CLOSED,
        `${vendor.name} does not offer delivery.`,
      );
    }
    if (request.orderType === ORDER_TYPE.PICKUP && !vendor.acceptsPickup) {
      throw AppException.unprocessable(
        ERROR_CODES.VENDOR_CLOSED,
        `${vendor.name} does not offer pickup.`,
      );
    }

    const products = await this.productModel
      .find({
        _id: { $in: request.lines.map((line) => new Types.ObjectId(line.productId)) },
        campusId: new Types.ObjectId(request.campusId),
        vendorId: new Types.ObjectId(request.vendorId),
        deletedAt: { $exists: false },
      })
      .lean();

    const byId = new Map(products.map((product) => [String(product._id), product]));

    const lines: PricedLine[] = [];
    let itemsTotal = 0;
    let maxPrepMinutes = vendor.avgPrepMinutes;

    for (const requested of request.lines) {
      const product = byId.get(requested.productId);
      if (!product) {
        throw AppException.unprocessable(
          ERROR_CODES.OUT_OF_STOCK,
          'An item in your cart is no longer on the menu.',
        );
      }
      if (!product.isAvailable) {
        throw AppException.unprocessable(
          ERROR_CODES.OUT_OF_STOCK,
          `${product.name} is unavailable right now.`,
        );
      }
      if (
        product.stockQuantity !== null &&
        product.stockQuantity !== undefined &&
        product.stockQuantity < requested.quantity
      ) {
        throw AppException.unprocessable(
          ERROR_CODES.OUT_OF_STOCK,
          `Only ${product.stockQuantity} of ${product.name} left.`,
        );
      }
      this.assertWithinServingWindow(product);

      const options = this.resolveOptions(product, requested.choiceIds ?? []);
      const unitPrice =
        product.basePrice + options.reduce((sum, option) => sum + option.priceDelta, 0);

      if (unitPrice < 0) {
        throw AppException.internal('Invalid option pricing on this item.');
      }

      const lineTotal = unitPrice * requested.quantity;
      itemsTotal += lineTotal;
      maxPrepMinutes = Math.max(maxPrepMinutes, product.prepMinutes);

      lines.push({
        productId: product._id,
        name: product.name,
        imageUrl: product.imageUrl,
        unitPrice,
        quantity: requested.quantity,
        options,
        notes: requested.notes,
        lineTotal,
      });
    }

    if (vendor.minOrderAmount > 0 && itemsTotal < vendor.minOrderAmount) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        `Minimum order for ${vendor.name} is ₹${(vendor.minOrderAmount / 100).toFixed(0)}.`,
      );
    }

    const isDelivery = request.orderType === ORDER_TYPE.DELIVERY;
    const packagingFee = vendor.packagingFee;
    let deliveryFee = isDelivery
      ? await this.resolveDeliveryFee(vendor, request.campusId, request.campusZoneId)
      : 0;

    let discount = 0;
    let coupon: Quote['coupon'];
    if (request.couponCode) {
      const evaluation = await this.couponsService.evaluate({
        campusId: request.campusId,
        userId: request.userId,
        vendorId: request.vendorId,
        code: request.couponCode,
        itemsTotal,
      });
      discount = evaluation.discount;
      if (evaluation.freeDelivery) deliveryFee = 0;
      coupon = {
        code: evaluation.code,
        couponId: evaluation.couponId,
        discount: evaluation.discount,
      };
    }

    // GST applies to the discounted food value plus packaging, not to delivery.
    const taxPercent = await this.settingsService.getNumber(
      request.campusId,
      'billing',
      'gstPercent',
      5,
    );
    const taxableBase = Math.max(0, itemsTotal - discount) + packagingFee;
    const taxTotal = percentOf(taxableBase, taxPercent);

    const grandTotal = Math.max(
      0,
      itemsTotal + packagingFee + deliveryFee + taxTotal - discount,
    );

    let walletApplied = 0;
    if (request.applyWallet) {
      const user = await this.userModel
        .findById(request.userId)
        .select('walletBalance')
        .lean();
      walletApplied = Math.min(user?.walletBalance ?? 0, grandTotal);
    }

    const breakdown: PriceBreakdown = {
      itemsTotal,
      packagingFee,
      deliveryFee,
      discount,
      walletApplied,
      taxTotal,
      grandTotal,
      payableNow: grandTotal - walletApplied,
    };

    return {
      vendorId: String(vendor._id),
      vendorName: vendor.name,
      lines,
      breakdown,
      coupon,
      etaMinutes: maxPrepMinutes + (isDelivery ? 10 : 0),
    };
  }

  /**
   * Validates the chosen options against the product's own definition: unknown
   * choices, sold-out choices, and violated min/max/required rules are all rejected,
   * which is what stops a crafted request from ordering a ₹0 pizza with everything.
   */
  /** Accepts a lean document as well as a hydrated one; only the option groups matter. */
  private resolveOptions(
    product: Pick<Product, 'name' | 'optionGroups'>,
    choiceIds: string[],
  ): PricedLine['options'] {
    const selected = new Set(choiceIds);
    const resolved: PricedLine['options'] = [];
    const known = new Set<string>();

    for (const group of product.optionGroups ?? []) {
      const chosen = group.choices.filter((choice) => selected.has(choice.id));
      for (const choice of group.choices) known.add(choice.id);

      if (group.required && chosen.length === 0) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          `Choose an option for "${group.name}".`,
        );
      }
      if (chosen.length < group.minSelect && chosen.length > 0) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          `Select at least ${group.minSelect} for "${group.name}".`,
        );
      }
      if (chosen.length > group.maxSelect) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          `Select at most ${group.maxSelect} for "${group.name}".`,
        );
      }

      for (const choice of chosen) {
        if (!choice.isAvailable) {
          throw AppException.unprocessable(
            ERROR_CODES.OUT_OF_STOCK,
            `"${choice.name}" is not available right now.`,
          );
        }
        resolved.push({
          groupId: group.id,
          groupName: group.name,
          choiceId: choice.id,
          choiceName: choice.name,
          priceDelta: choice.priceDelta,
        });
      }
    }

    const unknown = choiceIds.filter((id) => !known.has(id));
    if (unknown.length) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'An option you selected does not exist on this item.',
      );
    }

    return resolved;
  }

  /** Daypart items (breakfast, happy hour) are only orderable inside their window. */
  private assertWithinServingWindow(product: {
    name: string;
    availableFrom?: string;
    availableTo?: string;
  }): void {
    if (!product.availableFrom || !product.availableTo) return;

    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const withinWindow =
      product.availableFrom <= product.availableTo
        ? current >= product.availableFrom && current <= product.availableTo
        : // Window crossing midnight, e.g. 22:00-02:00.
          current >= product.availableFrom || current <= product.availableTo;

    if (!withinWindow) {
      throw AppException.unprocessable(
        ERROR_CODES.OUT_OF_STOCK,
        `${product.name} is only available between ${product.availableFrom} and ${product.availableTo}.`,
      );
    }
  }

  private async resolveDeliveryFee(
    vendor: { deliveryFee: number },
    campusId: string,
    campusZoneId?: string,
  ): Promise<Paise> {
    if (!campusZoneId) return vendor.deliveryFee;

    const campus = await this.campusModel
      .findById(campusId)
      .select('zones')
      .lean();
    const zone = campus?.zones?.find((entry) => String(entry._id) === campusZoneId);
    // A zone fee overrides the vendor default, which is how hostel-cluster pricing works.
    return zone?.deliveryFee ?? vendor.deliveryFee;
  }
}
