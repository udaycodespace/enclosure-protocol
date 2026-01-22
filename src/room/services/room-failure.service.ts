/**
 * RoomFailureService
 * Transitions room: IN_PROGRESS → FAILED
 * Triggered by admin or participant request.
 * Artifacts not released, containers locked.
 * Transition: ROOM_FAILED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomFailureService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    // TODO: ContainerModule coordination via module-level DI
  ) {}

  // TODO: Implement room failure logic (IN_PROGRESS → FAILED)
}
