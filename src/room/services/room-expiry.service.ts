/**
 * RoomExpiryService
 * Transitions room: INVITE_SENT → EXPIRED
 * System-triggered by scheduled job when expires_at <= NOW().
 * Transition: ROOM_EXPIRED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomExpiryService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // TODO: Implement room expiry logic (INVITE_SENT → EXPIRED)
}
