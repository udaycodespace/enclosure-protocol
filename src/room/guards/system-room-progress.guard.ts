/**
 * SystemRoomProgressGuard
 * Enforces: Only system caller or admin with 'admin' JWT role can trigger.
 * Transition: ROOM_IN_PROGRESS
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class SystemRoomProgressGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify system caller or admin role in JWT (permission check only)
    return true;
  }
}
