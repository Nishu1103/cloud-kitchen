import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AllowPortals, RequirePermissions, TenantId } from '@/common/decorators';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { AuditService } from './audit.service';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  actorId?: string;
}

@ApiTags('audit')
@Controller('admin/audit-logs')
@AllowPortals(PORTALS.ADMIN)
@RequirePermissions(PERMISSIONS.AUDIT_LOG_READ)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@TenantId() campusId: string, @Query() query: AuditQueryDto) {
    return this.auditService.list({
      campusId,
      action: query.action,
      resource: query.resource,
      actorId: query.actorId,
      page: query.page,
      limit: query.limit,
    });
  }
}
