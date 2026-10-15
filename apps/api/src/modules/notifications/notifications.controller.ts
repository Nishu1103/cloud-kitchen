import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PERMISSIONS } from '@ck/types';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { SKIP_ALL_THROTTLERS } from '@/common/throttler/named-throttler';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { parseQueryFlag, QUERY_FLAG_VALUES } from '@/common/dto/transforms';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import {
  MarkReadDto,
  RegisterDeviceDto,
  UnregisterDeviceDto,
  UpdatePreferencesDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

class ListNotificationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...QUERY_FLAG_VALUES])
  unreadOnly?: boolean | string;
}

/** Shared by all four portals: every signed-in user has a notification centre. */
@ApiTags('notifications')
@Controller('notifications')
@RequirePermissions(PERMISSIONS.NOTIFICATION_READ_OWN)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsDto) {
    return this.notificationsService.list(user.id, {
      page: query.page,
      limit: query.limit,
      unreadOnly: parseQueryFlag(query.unreadOnly),
    });
  }

  @Get('unread-count')
  @SkipThrottle(SKIP_ALL_THROTTLERS)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { unread: await this.notificationsService.unreadCount(user.id) };
  }

  @Patch('read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkReadDto) {
    return this.notificationsService.markRead(user.id, dto.ids);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('preferences')
  async preferences(@CurrentUser() user: AuthenticatedUser) {
    return { preferences: await this.notificationsService.preferences(user.id) };
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return {
      preferences: await this.notificationsService.updatePreferences(user.id, dto.preferences),
    };
  }

  /**
   * Called after the browser grants notification permission. One row per device, so
   * a student's phone, laptop and tablet all receive the same alert.
   */
  @Post('devices')
  async registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.pushService.registerToken({
      userId: user.id,
      campusId: user.campusId,
      token: dto.token,
      platform: dto.platform,
      browser: dto.browser,
      deviceLabel: dto.deviceLabel,
    });
    return { registered: true, pushEnabled: this.pushService.isEnabled };
  }

  @Delete('devices')
  async unregisterDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnregisterDeviceDto,
  ) {
    await this.pushService.removeToken(user.id, dto.token);
    return { unregistered: true };
  }
}
