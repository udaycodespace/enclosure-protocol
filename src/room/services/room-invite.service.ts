/**
 * RoomInviteService
 * Transitions room: ROOM_CREATED → INVITE_SENT
 * Transition: ROOM_CREATED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomInviteService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // TODO: Implement room invite logic (ROOM_CREATED → INVITE_SENT)
}
