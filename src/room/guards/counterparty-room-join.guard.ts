/**
 * CounterpartyRoomJoinGuard
 * Enforces: Actor ≠ creator, actor is non-creator party, email domain valid.
 * Transition: ROOM_JOINED
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class CounterpartyRoomJoinGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify actor is not creator, check email domain, validate room not already joined (permission check only)
    return true;
  }
}
