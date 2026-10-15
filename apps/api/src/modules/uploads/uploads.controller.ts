import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { CurrentUser, TenantId } from '@/common/decorators';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { UPLOAD_PURPOSES, UploadsService, type UploadPurpose } from './uploads.service';

class PresignDto {
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8 * 1024 * 1024)
  byteLength: number;
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /** Throttled: each signature is cheap for us but grants write access to the bucket. */
  @Post('presign')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  presign(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignDto,
  ) {
    return this.uploadsService.createPresignedUpload({
      userId: user.id,
      campusId,
      vendorId: user.vendorId,
      purpose: dto.purpose,
      contentType: dto.contentType,
      byteLength: dto.byteLength,
    });
  }
}
