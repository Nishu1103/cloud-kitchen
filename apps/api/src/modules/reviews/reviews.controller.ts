import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS, PORTALS } from '@ck/types';
import {
  AllowPortals,
  CurrentUser,
  Public,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import {
  CreateReviewDto,
  ModerateReviewDto,
  ReviewQueryDto,
  VendorReplyDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('vendor/:id')
  @Public()
  vendorReviews(@Param() params: ObjectIdParam, @Query() query: ReviewQueryDto) {
    return this.reviewsService.listForVendor(params.id, {
      page: query.page,
      limit: query.limit,
      rating: query.rating,
    });
  }

  @Get('product/:id')
  @Public()
  productReviews(@Param() params: ObjectIdParam, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listForProduct(params.id, query.page, query.limit);
  }

  @Get('mine')
  @AllowPortals(PORTALS.CUSTOMER)
  @RequirePermissions(PERMISSIONS.REVIEW_CREATE)
  mine(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reviewsService.listMine(campusId, user.id, query.page, query.limit);
  }

  @Post()
  @AllowPortals(PORTALS.CUSTOMER)
  @RequirePermissions(PERMISSIONS.REVIEW_CREATE)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(campusId, user.id, dto);
  }
}

@ApiTags('reviews')
@Controller('vendor/reviews')
@AllowPortals(PORTALS.VENDOR)
export class VendorReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REVIEW_REPLY)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ReviewQueryDto) {
    return this.reviewsService.listForVendor(this.vendorOf(user), {
      page: query.page,
      limit: query.limit,
      rating: query.rating,
    });
  }

  @Post(':id/reply')
  @RequirePermissions(PERMISSIONS.REVIEW_REPLY)
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: VendorReplyDto,
  ) {
    return this.reviewsService.reply(this.vendorOf(user), params.id, dto);
  }

  private vendorOf(user: AuthenticatedUser): string {
    if (!user.vendorId) throw AppException.forbidden('Your account is not linked to a kitchen.');
    return user.vendorId;
  }
}

@ApiTags('reviews')
@Controller('admin/reviews')
@AllowPortals(PORTALS.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REVIEW_MODERATE)
  list(@TenantId() campusId: string, @Query() query: ReviewQueryDto) {
    return this.reviewsService.listForAdmin(campusId, {
      page: query.page,
      limit: query.limit,
      hidden: query.hidden,
    });
  }

  @Patch(':id/moderate')
  @RequirePermissions(PERMISSIONS.REVIEW_MODERATE)
  moderate(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviewsService.setHidden(campusId, params.id, dto.isHidden, dto.reason);
  }
}
