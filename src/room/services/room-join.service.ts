/**
 * RoomJoinService
 * Transitions room: INVITE_SENT → JOINED
 * Transition: ROOM_JOINED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomJoinService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    // TODO: ContainerModule coordination via module-level DI
  ) {}

  // TODO: Implement room join logic (INVITE_SENT → JOINED)
}
