/**
 * PaymentModule
 * Manages payment aggregate lifecycle (APPEND-ONLY, immutable).
 * Dependencies: PaymentProviderModule, AuditModule, NotificationModule, RoomModule (forwardRef for saga).
 */

import { Module, forwardRef } from '@nestjs/common';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomModule } from '../room/room.module';

import { PaymentService } from './payment/payment.service';
import { PaymentConfirmationService } from './payment-confirmation/payment-confirmation.service';
import { PaymentFailureService } from './payment-failure/payment-failure.service';
import { RazorpayWebhookGuard } from './guards/razorpay-webhook.guard';
import { RazorpayPaymentConfirmedWebhook } from './webhooks/razorpay-payment-confirmed.webhook';
import { RazorpayPaymentFailedWebhook } from './webhooks/razorpay-payment-failed.webhook';

@Module({
  imports: [
    PaymentProviderModule,
    AuditModule,
    NotificationModule,
    forwardRef(() => RoomModule),
  ],
  providers: [
    PaymentService,
    PaymentConfirmationService,
    PaymentFailureService,
    RazorpayWebhookGuard,
  ],
  controllers: [RazorpayPaymentConfirmedWebhook, RazorpayPaymentFailedWebhook],
  exports: [PaymentService, PaymentConfirmationService, PaymentFailureService, RazorpayWebhookGuard],
})
export class PaymentModule {}
