import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import {
  Audit,
  CurrentUser,
  AllowPortals,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';
import {
  AddressDto,
  AdminUpdateUserDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UserQueryDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  /** The bootstrap call every portal makes after login. */
  @Get()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.me(user.id, user.portal);
  }

  @Patch()
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, user.portal, dto);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(user.id, dto);
  }

  @Get('addresses')
  @AllowPortals(PORTALS.CUSTOMER)
  addresses(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listAddresses(user.id);
  }

  @Post('addresses')
  @AllowPortals(PORTALS.CUSTOMER)
  addAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddressDto) {
    return this.usersService.addAddress(user.id, dto);
  }

  @Patch('addresses/:id')
  @AllowPortals(PORTALS.CUSTOMER)
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: AddressDto,
  ) {
    return this.usersService.updateAddress(user.id, params.id, dto);
  }

  @Delete('addresses/:id')
  @AllowPortals(PORTALS.CUSTOMER)
  removeAddress(@CurrentUser() user: AuthenticatedUser, @Param() params: ObjectIdParam) {
    return this.usersService.removeAddress(user.id, params.id);
  }

  @Delete()
  @Audit('user.self_delete', 'user')
  deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteAccount(user.id);
  }
}

@ApiTags('users')
@Controller('admin/users')
@AllowPortals(PORTALS.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  list(@TenantId() campusId: string, @Query() query: UserQueryDto) {
    return this.usersService.listForAdmin(campusId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  detail(@TenantId() campusId: string, @Param() params: ObjectIdParam) {
    return this.usersService.findForAdmin(campusId, params.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  async update(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: AdminUpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.usersService.adminUpdate(campusId, params.id, dto);
    await this.auditService.recordFromRequest(request, {
      action: 'user.update',
      resource: 'user',
      resourceId: params.id,
      metadata: { status: dto.status, reason: dto.statusReason },
    });
    return result;
  }
}
