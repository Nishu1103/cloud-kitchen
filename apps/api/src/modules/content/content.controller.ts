import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS, PORTALS } from '@ck/types';
import { IsIn } from 'class-validator';
import {
  AllowPortals,
  Audit,
  CurrentUser,
  Public,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam, SlugParam } from '@/common/dto/object-id.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { ContentService } from './content.service';
import {
  BANNER_PLACEMENTS,
  CreateBannerDto,
  CreateTicketDto,
  ReplyTicketDto,
  TicketQueryDto,
  UpsertPageDto,
} from './dto/content.dto';

class PlacementQueryDto {
  @IsIn(BANNER_PLACEMENTS)
  placement: string;
}

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('pages/:slug')
  @Public()
  page(@TenantId() campusId: string, @Param() params: SlugParam) {
    return this.contentService.publicPage(campusId, params.slug);
  }

  @Get('banners')
  @Public()
  banners(@TenantId() campusId: string, @Query() query: PlacementQueryDto) {
    return this.contentService.activeBanners(campusId, query.placement);
  }
}

@ApiTags('support')
@Controller('support')
@AllowPortals(PORTALS.CUSTOMER)
export class SupportController {
  constructor(private readonly contentService: ContentService) {}

  @Get('tickets')
  list(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.contentService.listMyTickets(campusId, user.id, query.page, query.limit);
  }

  @Get('tickets/:id')
  detail(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.contentService.findMyTicket(campusId, user.id, params.id);
  }

  @Post('tickets')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.contentService.createTicket(campusId, user.id, dto);
  }

  @Post('tickets/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  reply(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.contentService.addMessage(campusId, user.id, params.id, dto);
  }
}

@ApiTags('content')
@Controller('admin/content')
@AllowPortals(PORTALS.ADMIN)
export class AdminContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('pages')
  @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  pages(@TenantId() campusId: string) {
    return this.contentService.listPages(campusId);
  }

  @Post('pages')
  @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Audit('cms.page_upsert', 'cms_page')
  upsertPage(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertPageDto,
  ) {
    return this.contentService.upsertPage(campusId, user.id, dto);
  }

  @Delete('pages/:slug')
  @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Audit('cms.page_delete', 'cms_page')
  deletePage(@TenantId() campusId: string, @Param() params: SlugParam) {
    return this.contentService.deletePage(campusId, params.slug);
  }

  @Get('banners')
  @RequirePermissions(PERMISSIONS.BANNER_MANAGE)
  banners(@TenantId() campusId: string) {
    return this.contentService.listBanners(campusId);
  }

  @Post('banners')
  @RequirePermissions(PERMISSIONS.BANNER_MANAGE)
  @Audit('cms.banner_create', 'banner')
  createBanner(@TenantId() campusId: string, @Body() dto: CreateBannerDto) {
    return this.contentService.createBanner(campusId, dto);
  }

  @Patch('banners/:id')
  @RequirePermissions(PERMISSIONS.BANNER_MANAGE)
  @Audit('cms.banner_update', 'banner')
  updateBanner(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: CreateBannerDto,
  ) {
    return this.contentService.updateBanner(campusId, params.id, dto);
  }

  @Delete('banners/:id')
  @RequirePermissions(PERMISSIONS.BANNER_MANAGE)
  @Audit('cms.banner_delete', 'banner')
  deleteBanner(@TenantId() campusId: string, @Param() params: ObjectIdParam) {
    return this.contentService.deleteBanner(campusId, params.id);
  }

  @Get('tickets')
  @RequirePermissions(PERMISSIONS.SUPPORT_TICKET_MANAGE)
  tickets(@TenantId() campusId: string, @Query() query: TicketQueryDto) {
    return this.contentService.listTicketsForAdmin(campusId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }

  @Post('tickets/:id/reply')
  @RequirePermissions(PERMISSIONS.SUPPORT_TICKET_MANAGE)
  replyTicket(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.contentService.staffReply(campusId, user.id, params.id, dto);
  }
}
