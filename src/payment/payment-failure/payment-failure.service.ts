/**
 * PaymentFailureService
 * Transitions payment: PENDING → FAILED on Razorpay webhook failure.
 * Side effects: notify payer of payment failure.
 * Transition: PAYMENT_FAILED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class PaymentFailureService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // TODO: Implement PAYMENT_FAILED transition (PENDING → FAILED)
}
