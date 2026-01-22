/**
 * ParticipantRoomValidationStartGuard
 * Enforces: Actor is participant, both containers sealed.
 * Transition: ROOM_UNDER_VALIDATION
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ParticipantRoomValidationStartGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify actor is participant, both containers sealed (permission check only)
    return true;
  }
}
