import { Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookGuard } from './razorpay-webhook.guard';

/**
 * PaymentProviderModule
 * 
 * Integrates with Razorpay payment gateway. Creates payment orders, verifies webhooks,
 * and queries payment status. Webhook signature verification is performed here.
 */
@Module({
  providers: [RazorpayService, RazorpayWebhookGuard],
  exports: [RazorpayService, RazorpayWebhookGuard],
})
export class PaymentProviderModule {}
