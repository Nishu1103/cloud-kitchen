import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import {
  AllowPortals,
  CurrentUser,
  Public,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { CatalogService } from './catalog.service';
import {
  BrowseProductsDto,
  CreateCategoryDto,
  CreateProductDto,
  ToggleFlagsDto,
  UpdateProductDto,
  UpdateStockDto,
} from './dto/catalog.dto';

/**
 * Public menu surface, tenant-scoped by campus slug.
 *
 * Menus are readable without a session for the same reason kitchens are: a student
 * decides what to eat before deciding to sign up. Only available, non-hidden dishes from
 * approved kitchens are returned, and prices are always computed server-side at checkout,
 * so nothing here can be relied on by a client to its own advantage.
 */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  @Public()
  browse(@TenantId() campusId: string, @Query() query: BrowseProductsDto) {
    return this.catalogService.browse(campusId, query);
  }

  @Get('categories')
  @Public()
  categories(@TenantId() campusId: string) {
    return this.catalogService.listCategories(campusId);
  }

  @Get('vendors/:id/menu')
  @Public()
  menu(@TenantId() campusId: string, @Param() params: ObjectIdParam) {
    return this.catalogService.menu(campusId, params.id);
  }
}

@ApiTags('catalog')
@Controller('vendor/menu')
@AllowPortals(PORTALS.VENDOR)
export class VendorMenuController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  @RequirePermissions(PERMISSIONS.PRODUCT_READ)
  list(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BrowseProductsDto,
  ) {
    return this.catalogService.listForVendor(campusId, this.vendorOf(user), query);
  }

  @Post('products')
  @RequirePermissions(PERMISSIONS.PRODUCT_CREATE)
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalogService.createProduct(campusId, this.vendorOf(user), dto);
  }

  /**
   * Bulk merchandising: flip "today's special" or "flash sale" across many items.
   * Declared before `products/:id` so the literal path is not swallowed by the
   * parameterised route.
   */
  @Patch('products/flags')
  @RequirePermissions(PERMISSIONS.PRODUCT_UPDATE)
  flags(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ToggleFlagsDto,
  ) {
    return this.catalogService.toggleFlags(campusId, this.vendorOf(user), dto);
  }

  @Patch('products/:id')
  @RequirePermissions(PERMISSIONS.PRODUCT_UPDATE)
  update(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(campusId, this.vendorOf(user), params.id, dto);
  }

  @Delete('products/:id')
  @RequirePermissions(PERMISSIONS.PRODUCT_DELETE)
  remove(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.catalogService.deleteProduct(campusId, this.vendorOf(user), params.id);
  }

  @Patch('products/:id/stock')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  stock(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateStockDto,
  ) {
    return this.catalogService.updateStock(campusId, this.vendorOf(user), params.id, dto);
  }

  @Get('categories')
  @RequirePermissions(PERMISSIONS.PRODUCT_READ)
  categories(@TenantId() campusId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogService.listCategories(campusId, this.vendorOf(user));
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.CATEGORY_MANAGE)
  createCategory(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalogService.createCategory(campusId, dto, this.vendorOf(user));
  }

  private vendorOf(user: AuthenticatedUser): string {
    if (!user.vendorId) throw AppException.forbidden('Your account is not linked to a kitchen.');
    return user.vendorId;
  }
}

@ApiTags('catalog')
@Controller('admin/categories')
@AllowPortals(PORTALS.ADMIN)
@RequirePermissions(PERMISSIONS.CATEGORY_MANAGE)
export class AdminCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@TenantId() campusId: string) {
    return this.catalogService.listCategories(campusId);
  }

  /** Campus-wide category, available to every kitchen. */
  @Post()
  create(@TenantId() campusId: string, @Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(campusId, dto);
  }
}
