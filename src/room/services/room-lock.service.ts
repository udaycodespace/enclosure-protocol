/**
 * RoomLockService
 * Transitions room: JOINED → LOCKED
 * Triggers payment capture for placement and validation fees.
 * 
 * Guard-required transition: JOINED → LOCKED
 * Preconditions enforced by RoomLockGuard:
 *   - User is room participant
 *   - Room state = JOINED
 *   - Fresh OTP (< 5 min) verified
 *   - No previous payment in-flight
 *   - Session freshness < 5 min
 *   - Payment can be initiated (5% placement fee)
 * 
 * Side effects (after guard passes):
 *   - Payment initiated for 5% placement fee (both parties)
 *   - Room state transition: JOINED → LOCKED
 *   - Audit logged: LOCK_INITIATED
 * 
 * Transition: ROOM_LOCKED
 */

import { Injectable } from '@nestjs/common';
import { PaymentService } from '../../payment/payment/payment.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomLockService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // TODO: Implement room lock logic (JOINED → LOCKED)
}
