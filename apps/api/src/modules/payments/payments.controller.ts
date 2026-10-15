import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS } from '@ck/types';
import { IsMongoId, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Public, RequirePermissions, SkipCsrf } from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { PaymentsService } from './payments.service';

class ConfirmPaymentDto {
  @IsMongoId()
  paymentId: string;

  @IsString()
  @MaxLength(120)
  providerPaymentId: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('confirm')
  @RequirePermissions(PERMISSIONS.ORDER_PLACE)
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirm({
      userId: user.id,
      paymentId: dto.paymentId,
      providerPaymentId: dto.providerPaymentId,
    });
  }

  @Get('orders/:id')
  @RequirePermissions(PERMISSIONS.PAYMENT_READ_OWN)
  forOrder(@CurrentUser() user: AuthenticatedUser, @Param() params: ObjectIdParam) {
    return this.paymentsService.findForOrder(params.id, user.id);
  }
}

/**
 * Gateway webhook.
 *
 * `@Public` because the caller is a server, not a session, and `@SkipCsrf` because
 * there is no cookie to ride. Authenticity comes from the HMAC signature over the
 * raw body - which is why the raw buffer is preserved in the bootstrap rather than
 * only the parsed JSON.
 */
@ApiTags('payments')
@Controller('webhooks/payments')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Public()
  @SkipCsrf()
  @Throttle({ webhook: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() request: AuthenticatedRequest,
    @Headers('x-razorpay-signature') razorpaySignature?: string,
    @Headers('x-webhook-signature') genericSignature?: string,
  ) {
    if (!request.rawBody) {
      throw AppException.internal('Raw body unavailable for signature verification.');
    }
    return this.paymentsService.handleWebhook(
      request.rawBody,
      razorpaySignature ?? genericSignature,
    );
  }
}
