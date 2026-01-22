/**
 * CreatorRoomInviteGuard
 * Enforces: Actor must be room creator, room fields valid, email domain whitelisted.
 * Transition: ROOM_CREATED
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class CreatorRoomInviteGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify actor is creator, validate room fields, check email domain (permission check only)
    return true;
  }
}
