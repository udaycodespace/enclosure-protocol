/**
 * RazorpayPaymentConfirmedWebhook
 * Receives payment.confirmed event from Razorpay.
 * Triggers PaymentConfirmationService to transition payment: PENDING → CONFIRMED.
 * Webhook isolation: separate code path from user-initiated flows.
 */

import { Injectable, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentConfirmationService } from '../payment-confirmation/payment-confirmation.service';
import { RazorpayWebhookGuard } from '../guards/razorpay-webhook.guard';

@Injectable()
@Controller('webhooks/razorpay')
export class RazorpayPaymentConfirmedWebhook {
  constructor(
    private readonly paymentConfirmationService: PaymentConfirmationService,
    private readonly razorpayWebhookGuard: RazorpayWebhookGuard,
  ) {}

  @Post('payment-confirmed')
  @UseGuards(RazorpayWebhookGuard)
  // TODO: Implement webhook handler for payment.confirmed event
  async handle() {}
}
