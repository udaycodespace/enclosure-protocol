/**
 * RoomProgressService
 * Transitions room: LOCKED → IN_PROGRESS
 * System-triggered when all payments are confirmed.
 * 
 * Guard-required transition: LOCKED → IN_PROGRESS (System only)
 * Preconditions enforced by RoomProgressGuard:
 *   - System context (SYSTEM role only)
 *   - Room state = LOCKED
 *   - All payments.status = CONFIRMED
 *   - No inactivity timeout (< 96 hours since LOCK)
 *   - No open disputes
 * 
 * Side effects (after guard passes):
 *   - Room state transition: LOCKED → IN_PROGRESS
 *   - Containers state reset: EMPTY (ready for artifact uploads)
 *   - Audit logged: PROGRESS_INITIATED
 * 
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
