/**
 * RoomLockService
 * Transitions room: JOINED → LOCKED
 * Triggers payment capture for placement and validation fees.
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
