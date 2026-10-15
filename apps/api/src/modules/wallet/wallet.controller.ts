import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  AllowPortals,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';
import { WalletService } from './wallet.service';

class AdjustWalletDto {
  /** Signed paise: negative debits. Bounded so a slip cannot move a fortune. */
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  amount: number;

  @IsString()
  @MaxLength(200)
  reason: string;
}

@ApiTags('wallet')
@Controller('wallet')
@RequirePermissions(PERMISSIONS.WALLET_READ_OWN)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  balance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.balance(user.id);
  }

  @Get('transactions')
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.walletService.history(user.id, query.page, query.limit);
  }
}

@ApiTags('wallet')
@Controller('admin/wallet')
@AllowPortals(PORTALS.ADMIN)
@RequirePermissions(PERMISSIONS.WALLET_ADJUST)
export class AdminWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users/:id')
  balance(@Param() params: ObjectIdParam) {
    return this.walletService.balance(params.id);
  }

  @Get('users/:id/transactions')
  history(@Param() params: ObjectIdParam, @Query() query: PaginationQueryDto) {
    return this.walletService.history(params.id, query.page, query.limit);
  }

  @Post('users/:id/adjust')
  async adjust(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: AdjustWalletDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.walletService.adjust({
      userId: params.id,
      campusId,
      amount: dto.amount,
      reason: dto.reason,
      performedBy: user.id,
    });
    await this.auditService.recordFromRequest(request, {
      action: 'wallet.adjust',
      resource: 'wallet',
      resourceId: params.id,
      metadata: { amount: dto.amount, reason: dto.reason, balanceAfter: result.balance },
    });
    return result;
  }
}
