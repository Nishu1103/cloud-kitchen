import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import {
  AllowPortals,
  Audit,
  CurrentUser,
  Public,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam, SlugParam } from '@/common/dto/object-id.dto';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { CampusesService } from './campuses.service';
import { CreateCampusDto, CreateZoneDto, UpdateCampusDto } from './dto/campus.dto';

@ApiTags('campuses')
@Controller('campuses')
export class CampusesController {
  constructor(private readonly campusesService: CampusesService) {}

  @Get()
  @Public()
  list() {
    return this.campusesService.listPublic();
  }

  @Get(':slug')
  @Public()
  bySlug(@Param() params: SlugParam) {
    return this.campusesService.publicBySlug(params.slug);
  }
}

@ApiTags('campuses')
@Controller('admin/campuses')
@AllowPortals(PORTALS.ADMIN)
export class AdminCampusesController {
  constructor(private readonly campusesService: CampusesService) {}

  /** Super-admin only: this is the tenant list across the whole platform. */
  @Get()
  @RequirePermissions(PERMISSIONS.CAMPUS_READ_ALL)
  list() {
    return this.campusesService.listAll();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CAMPUS_CREATE)
  @Audit('campus.create', 'campus')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampusDto) {
    return this.campusesService.create(dto, user.id);
  }

  @Get('current')
  @RequirePermissions(PERMISSIONS.CAMPUS_READ)
  current(@TenantId() campusId: string) {
    return this.campusesService.findById(campusId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CAMPUS_UPDATE)
  @Audit('campus.update', 'campus')
  update(@Param() params: ObjectIdParam, @Body() dto: UpdateCampusDto) {
    return this.campusesService.update(params.id, dto);
  }

  @Get('current/zones')
  @RequirePermissions(PERMISSIONS.CAMPUS_READ)
  zones(@TenantId() campusId: string) {
    return this.campusesService.listZones(campusId);
  }

  @Post('current/zones')
  @RequirePermissions(PERMISSIONS.CAMPUS_UPDATE)
  @Audit('campus.zone_create', 'campus_zone')
  createZone(@TenantId() campusId: string, @Body() dto: CreateZoneDto) {
    return this.campusesService.createZone(campusId, dto);
  }

  @Patch('current/zones/:id')
  @RequirePermissions(PERMISSIONS.CAMPUS_UPDATE)
  @Audit('campus.zone_update', 'campus_zone')
  updateZone(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: CreateZoneDto,
  ) {
    return this.campusesService.updateZone(campusId, params.id, dto);
  }
}
