/**
 * SystemRoomExpiryGuard
 * Enforces: Only system caller, room expired (expires_at <= NOW()).
 * Transition: ROOM_EXPIRED
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class SystemRoomExpiryGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify system caller, room expired (permission check only)
    return true;
  }
}
