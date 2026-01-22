/**
 * RoomProgressService
 * Transitions room: LOCKED → IN_PROGRESS
 * System-triggered when all payments are confirmed.
 * Transition: ROOM_IN_PROGRESS
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomProgressService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    // TODO: ContainerModule coordination via module-level DI
  ) {}

  // TODO: Implement room progress logic (LOCKED → IN_PROGRESS)
}
