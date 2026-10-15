import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ALL_PERMISSIONS, PERMISSIONS, PORTALS } from '@ck/types';
import {
  AllowPortals,
  Audit,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';
import { AssignRolesDto, CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('rbac')
@Controller('admin/roles')
@AllowPortals(PORTALS.ADMIN)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly auditService: AuditService,
  ) {}

  /** Catalogue of assignable permissions, used to render the role editor. */
  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  listPermissions() {
    return { permissions: ALL_PERMISSIONS };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  list(@TenantId() campusId: string) {
    return this.rolesService.list(campusId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @Audit('role.create', 'role')
  async create(
    @TenantId() campusId: string,
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const role = await this.rolesService.create(campusId, dto, user.permissions);
    await this.auditService.recordFromRequest(request, {
      action: 'role.create',
      resource: 'role',
      resourceId: String(role._id),
      metadata: { slug: dto.slug, permissions: dto.permissions },
    });
    return role;
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  async update(
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const role = await this.rolesService.update(params.id, dto, user.permissions);
    await this.auditService.recordFromRequest(request, {
      action: 'role.update',
      resource: 'role',
      resourceId: params.id,
      metadata: { changes: dto },
    });
    return role;
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  async remove(@Param() params: ObjectIdParam, @Req() request: AuthenticatedRequest) {
    await this.rolesService.remove(params.id);
    await this.auditService.recordFromRequest(request, {
      action: 'role.delete',
      resource: 'role',
      resourceId: params.id,
    });
    return { deleted: true };
  }

  @Post('users/:id/assign')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE, PERMISSIONS.USER_UPDATE)
  async assign(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: AssignRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.rolesService.assignToUser(
      campusId,
      params.id,
      dto.roleIds,
      user.permissions,
      user.id,
    );
    await this.auditService.recordFromRequest(request, {
      action: 'user.roles_assign',
      resource: 'user',
      resourceId: params.id,
      metadata: { roleIds: dto.roleIds },
    });
    return result;
  }
}
