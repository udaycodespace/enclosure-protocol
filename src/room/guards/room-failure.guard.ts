/**
 * RoomFailureGuard
 * Enforces: Actor is admin or participant.
 * Transition: ROOM_FAILED
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class RoomFailureGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify actor is admin or participant (permission check only)
    return true;
  }
}
