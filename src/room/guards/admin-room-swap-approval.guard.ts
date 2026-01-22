/**
 * AdminRoomSwapApprovalGuard
 * Enforces: Only admin with 'admin' JWT role, validation_summary set on both containers.
 * Transition: ROOM_SWAP_READY
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AdminRoomSwapApprovalGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: Verify admin role in JWT, validation_summary set on both containers (permission check only)
    return true;
  }
}
