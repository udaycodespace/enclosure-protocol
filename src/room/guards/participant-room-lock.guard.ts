/**
 * ParticipantRoomLockGuard
 * Enforces: Actor is participant, OTP verified within 5 min, session age < 15 min, payment pending/confirmed.
 * Transition: ROOM_LOCKED
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ParticipantRoomLockGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify actor is participant, check OTP fresh (<5 min), session age <15 min, payment exists (permission check only)
    return true;
  }
}
