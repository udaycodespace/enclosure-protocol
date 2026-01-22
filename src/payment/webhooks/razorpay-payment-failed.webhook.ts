/**
 * RazorpayPaymentFailedWebhook
 * Receives payment.failed event from Razorpay.
 * Triggers PaymentFailureService to transition payment: PENDING → FAILED.
 * Webhook isolation: separate code path from user-initiated flows.
 */

import { Injectable, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentFailureService } from '../payment-failure/payment-failure.service';
import { RazorpayWebhookGuard } from '../guards/razorpay-webhook.guard';

@Injectable()
@Controller('webhooks/razorpay')
export class RazorpayPaymentFailedWebhook {
  constructor(
    private readonly paymentFailureService: PaymentFailureService,
    private readonly razorpayWebhookGuard: RazorpayWebhookGuard,
  ) {}

  @Post('payment-failed')
  @UseGuards(RazorpayWebhookGuard)
  // TODO: Implement webhook handler for payment.failed event
  async handle() {}
}
