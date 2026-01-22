/**
 * RazorpayWebhookGuard
 * Verifies webhook signature before PaymentModule processes payment callbacks.
 * Guard belongs to PaymentModule (co-located with aggregate being protected).
 * Permission check: validate Razorpay signature on webhook payload.
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { RazorpayService } from '../../payment-provider/razorpay.service';

@Injectable()
export class RazorpayWebhookGuard implements CanActivate {
  constructor(private readonly razorpayService: RazorpayService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify Razorpay webhook signature (permission check only, no mutation)
    return true;
  }
}
