/**
 * PaymentConfirmationService
 * Transitions payment: PENDING → CONFIRMED on Razorpay webhook success.
 * Side effects: notify payer, trigger room progress (saga pattern via RoomProgressService).
 * Transition: PAYMENT_CONFIRMED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class PaymentConfirmationService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    // TODO: Inject RoomProgressService once available (forwardRef to avoid circular import)
    // private readonly roomProgressService: RoomProgressService,
  ) {}

  // TODO: Implement PAYMENT_CONFIRMED transition (PENDING → CONFIRMED)
}
