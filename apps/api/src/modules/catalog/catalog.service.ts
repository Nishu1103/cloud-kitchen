import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  NOTIFICATION_TYPE,
  VENDOR_STATUS,
  WS_EVENTS,
  type PaginatedResult,
} from '@ck/types';
import { Model, Types, type ClientSession } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { buildSort, escapeRegex, paginated } from '@/common/utils/pagination.util';
import {
  Category,
  Product,
  Vendor,
  type CategoryDocument,
  type ProductDocument,
  type VendorDocument,
} from '@/database/schemas';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { UploadsService } from '@/modules/uploads/uploads.service';
import type {
  BrowseProductsDto,
  CreateCategoryDto,
  CreateProductDto,
  ToggleFlagsDto,
  UpdateProductDto,
  UpdateStockDto,
} from './dto/catalog.dto';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly uploads: UploadsService,
  ) {}

  async browse(campusId: string, query: BrowseProductsDto): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      isAvailable: true,
      deletedAt: { $exists: false },
      // Hidden is a vendor-controlled flag for items that exist but must not surface.
      flags: { $ne: 'hidden' },
    };
    if (query.vendorId) filter.vendorId = new Types.ObjectId(query.vendorId);
    if (query.categoryId) filter.categoryId = new Types.ObjectId(query.categoryId);
    if (query.diet) filter.diet = query.diet;
    if (query.flag) filter.flags = query.flag;
    if (query.maxPrice !== undefined) filter.basePrice = { $lte: query.maxPrice };
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: pattern }, { tags: pattern }];
    }

    const sort = buildSort(
      query.sortBy?.replace('price', 'basePrice'),
      ['basePrice', 'rating', 'soldCount'],
      { sortOrder: 1, soldCount: -1 },
    );

    // Scoped to live kitchens: a suspended or pending vendor's dishes must not surface
    // in browse or search, even though the product documents themselves stay available.
    const liveVendorIds = await this.liveVendorIds(campusId, query.vendorId);
    if (liveVendorIds.length === 0) return paginated([], 0, query.page, query.limit);
    filter.vendorId = { $in: liveVendorIds };

    const [items, total] = await Promise.all([
      this.productModel.find(filter).sort(sort).skip(query.skip).limit(query.limit).lean(),
      this.productModel.countDocuments(filter),
    ]);

    return paginated(await this.attachVendors(items), total, query.page, query.limit);
  }

  private async liveVendorIds(campusId: string, vendorId?: string): Promise<Types.ObjectId[]> {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      status: VENDOR_STATUS.APPROVED,
      deletedAt: { $exists: false },
    };
    if (vendorId) filter._id = new Types.ObjectId(vendorId);

    const vendors = await this.vendorModel.find(filter).select('_id').lean();
    return vendors.map((vendor) => vendor._id);
  }

  /**
   * Adds the owning kitchen to each dish.
   *
   * A search result that names only the dish is not actionable: the student cannot tell
   * whose kitchen it is, whether it is open, or where to tap next.
   */
  private async attachVendors(
    products: { vendorId?: Types.ObjectId }[],
  ): Promise<unknown[]> {
    const ids = [...new Set(products.map((product) => String(product.vendorId)))];
    if (ids.length === 0) return products;

    const vendors = await this.vendorModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name slug logoUrl isOpen avgPrepMinutes')
      .lean();

    const byId = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));
    return products.map((product) => ({
      ...product,
      vendor: byId.get(String(product.vendorId)),
    }));
  }

  /**
   * Full menu for one kitchen, grouped into its sections.
   *
   * The kitchen is resolved first and must be approved: this route is public, and reading
   * a menu by id would otherwise expose a pending applicant's or a suspended kitchen's
   * catalogue to anyone who guessed the id.
   */
  async menu(campusId: string, vendorId: string) {
    const vendor = await this.vendorModel
      .findOne({
        _id: new Types.ObjectId(vendorId),
        campusId: new Types.ObjectId(campusId),
        status: VENDOR_STATUS.APPROVED,
        deletedAt: { $exists: false },
      })
      .select('name slug tagline logoUrl coverUrl cuisines isOpen acceptsDelivery acceptsPickup rating ratingCount avgPrepMinutes minOrderAmount packagingFee deliveryFee operatingHours themeColor status')
      .lean();
    if (!vendor) throw AppException.notFound('Kitchen');

    const [categories, products] = await Promise.all([
      this.categoryModel
        .find({
          campusId: new Types.ObjectId(campusId),
          $or: [{ vendorId: new Types.ObjectId(vendorId) }, { vendorId: null }],
          isActive: true,
        })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      this.productModel
        .find({
          campusId: new Types.ObjectId(campusId),
          vendorId: new Types.ObjectId(vendorId),
          deletedAt: { $exists: false },
          flags: { $ne: 'hidden' },
        })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
    ]);

    const uncategorised = products.filter((product) => !product.categoryId);
    const sections = categories
      .map((category) => ({
        category,
        products: products.filter(
          (product) => String(product.categoryId) === String(category._id),
        ),
      }))
      .filter((section) => section.products.length > 0);

    if (uncategorised.length) {
      sections.push({
        category: { _id: null, name: 'More', slug: 'more', sortOrder: 999 } as never,
        products: uncategorised,
      });
    }
    return { vendor, sections };
  }

  async listForVendor(campusId: string, vendorId: string, query: BrowseProductsDto) {
    const filter: Record<string, unknown> = {
      campusId: new Types.ObjectId(campusId),
      vendorId: new Types.ObjectId(vendorId),
      deletedAt: { $exists: false },
    };
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');
    if (query.categoryId) filter.categoryId = new Types.ObjectId(query.categoryId);

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ sortOrder: 1, name: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async createProduct(campusId: string, vendorId: string, dto: CreateProductDto) {
    this.assertOptionGroupsCoherent(dto);
    await this.assertVendorApproved(campusId, vendorId);
    if (dto.categoryId) await this.assertCategoryUsable(campusId, vendorId, dto.categoryId);
    this.uploads.assertPersistedImageUrl(dto.imageUrl, {
      campusId,
      vendorId,
      folders: ['menus'],
    });

    const product = await this.productModel.create({
      ...dto,
      campusId: new Types.ObjectId(campusId),
      vendorId: new Types.ObjectId(vendorId),
      categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
      slug: await this.uniqueSlug(campusId, vendorId, dto.name),
    });
    return product.toJSON();
  }

  async updateProduct(
    campusId: string,
    vendorId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    this.assertOptionGroupsCoherent(dto);
    if (dto.categoryId) await this.assertCategoryUsable(campusId, vendorId, dto.categoryId);
    this.uploads.assertPersistedImageUrl(dto.imageUrl, {
      campusId,
      vendorId,
      folders: ['menus'],
    });

    const product = await this.productModel.findOne({
      _id: new Types.ObjectId(productId),
      // Tenant and owner are part of the filter, so one vendor can never edit another's item.
      campusId: new Types.ObjectId(campusId),
      vendorId: new Types.ObjectId(vendorId),
    });
    if (!product) throw AppException.notFound('Item');

    Object.assign(product, dto, {
      categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : product.categoryId,
    });
    await product.save();
    return product.toJSON();
  }

  /** Soft delete: existing orders must keep resolving the item they contain. */
  async deleteProduct(campusId: string, vendorId: string, productId: string) {
    const result = await this.productModel.updateOne(
      {
        _id: new Types.ObjectId(productId),
        campusId: new Types.ObjectId(campusId),
        vendorId: new Types.ObjectId(vendorId),
      },
      { $set: { deletedAt: new Date(), isAvailable: false } },
    );
    if (!result.matchedCount) throw AppException.notFound('Item');
    return { deleted: true };
  }

  async updateStock(
    campusId: string,
    vendorId: string,
    productId: string,
    dto: UpdateStockDto,
  ) {
    const product = await this.productModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        campusId: new Types.ObjectId(campusId),
        vendorId: new Types.ObjectId(vendorId),
      },
      { $set: dto },
      { new: true },
    );
    if (!product) throw AppException.notFound('Item');

    this.gateway.emitToVendor(vendorId, WS_EVENTS.VENDOR_STOCK_UPDATED, {
      productId,
      stockQuantity: product.stockQuantity,
      isAvailable: product.isAvailable,
    });
    return product.toJSON();
  }

  async toggleFlags(campusId: string, vendorId: string, dto: ToggleFlagsDto) {
    const update = dto.enabled ? { $addToSet: { flags: dto.flag } } : { $pull: { flags: dto.flag } };
    const result = await this.productModel.updateMany(
      {
        _id: { $in: dto.productIds.map((id) => new Types.ObjectId(id)) },
        campusId: new Types.ObjectId(campusId),
        vendorId: new Types.ObjectId(vendorId),
      },
      update,
    );
    return { updated: result.modifiedCount };
  }

  /**
   * Atomically reserves stock for an order.
   *
   * The decrement is conditional on sufficient stock in the same operation, so two
   * students racing for the last plate cannot both succeed. Runs inside the order
   * transaction and is therefore rolled back if payment setup fails.
   */
  async reserveStock(
    lines: Array<{ productId: string; quantity: number }>,
    session: ClientSession,
  ): Promise<void> {
    for (const line of lines) {
      const result = await this.productModel.updateOne(
        {
          _id: new Types.ObjectId(line.productId),
          $or: [
            { stockQuantity: null },
            { stockQuantity: { $gte: line.quantity } },
          ],
        },
        [
          {
            $set: {
              stockQuantity: {
                $cond: [
                  { $eq: ['$stockQuantity', null] },
                  null,
                  { $subtract: ['$stockQuantity', line.quantity] },
                ],
              },
              soldCount: { $add: ['$soldCount', line.quantity] },
            },
          },
        ],
        { session },
      );

      if (!result.matchedCount) {
        throw AppException.unprocessable(
          ERROR_CODES.OUT_OF_STOCK,
          'One of the items just sold out. Please review your cart.',
        );
      }
    }
  }

  /** Returns stock when an order is cancelled or rejected. */
  async releaseStock(
    lines: Array<{ productId: string; quantity: number }>,
    session?: ClientSession,
  ): Promise<void> {
    for (const line of lines) {
      await this.productModel.updateOne(
        { _id: new Types.ObjectId(line.productId), stockQuantity: { $ne: null } },
        { $inc: { stockQuantity: line.quantity, soldCount: -line.quantity } },
        session ? { session } : {},
      );
    }
  }

  /** Warns the kitchen before an item silently becomes unorderable. */
  async checkLowStock(campusId: string, vendorId: string, ownerId?: string): Promise<void> {
    if (!ownerId) return;
    const low = await this.productModel
      .find({
        campusId: new Types.ObjectId(campusId),
        vendorId: new Types.ObjectId(vendorId),
        stockQuantity: { $ne: null },
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
        isAvailable: true,
      })
      .select('name stockQuantity')
      .limit(5)
      .lean();

    if (!low.length) return;
    await this.notificationsService.notify({
      userId: ownerId,
      campusId,
      type: NOTIFICATION_TYPE.VENDOR_LOW_STOCK,
      title: 'Running low on stock',
      body: low.map((item) => `${item.name} (${item.stockQuantity} left)`).join(', '),
      deepLink: '/menu',
      collapseKey: `low-stock:${vendorId}`,
    });
  }

  async listCategories(campusId: string, vendorId?: string) {
    return this.categoryModel
      .find({
        campusId: new Types.ObjectId(campusId),
        ...(vendorId
          ? { $or: [{ vendorId: new Types.ObjectId(vendorId) }, { vendorId: null }] }
          : {}),
      })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  async createCategory(campusId: string, dto: CreateCategoryDto, vendorId?: string) {
    return this.categoryModel.create({
      ...dto,
      campusId: new Types.ObjectId(campusId),
      vendorId: vendorId ? new Types.ObjectId(vendorId) : null,
    });
  }

  private async assertVendorApproved(campusId: string, vendorId: string): Promise<void> {
    const vendor = await this.vendorModel
      .findOne({
        _id: new Types.ObjectId(vendorId),
        campusId: new Types.ObjectId(campusId),
      })
      .select('status')
      .lean();
    if (!vendor) throw AppException.notFound('Kitchen');
    if (vendor.status === VENDOR_STATUS.SUSPENDED || vendor.status === VENDOR_STATUS.REJECTED) {
      throw AppException.forbidden('Your kitchen cannot be edited in its current state.');
    }
  }

  private async assertCategoryUsable(
    campusId: string,
    vendorId: string,
    categoryId: string,
  ): Promise<void> {
    const exists = await this.categoryModel.exists({
      _id: new Types.ObjectId(categoryId),
      campusId: new Types.ObjectId(campusId),
      $or: [{ vendorId: new Types.ObjectId(vendorId) }, { vendorId: null }],
    });
    if (!exists) {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'That category does not exist.');
    }
  }

  /** Option groups whose bounds contradict each other would make pricing ambiguous. */
  private assertOptionGroupsCoherent(dto: Partial<CreateProductDto>): void {
    for (const group of dto.optionGroups ?? []) {
      if (group.minSelect > group.maxSelect) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          `Option group "${group.name}": minimum cannot exceed maximum.`,
        );
      }
      if (group.maxSelect > group.choices.length) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          `Option group "${group.name}": maximum exceeds the number of choices.`,
        );
      }
      const ids = new Set(group.choices.map((choice) => choice.id));
      if (ids.size !== group.choices.length) {
        throw AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          `Option group "${group.name}": choice ids must be unique.`,
        );
      }
    }
  }

  private async uniqueSlug(campusId: string, vendorId: string, name: string): Promise<string> {
    const base = slugify(name) || 'item';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const exists = await this.productModel.exists({
        campusId: new Types.ObjectId(campusId),
        vendorId: new Types.ObjectId(vendorId),
        slug: candidate,
      });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
