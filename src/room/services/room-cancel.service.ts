/**
 * RoomCancelService
 * Transitions room: Any state → CANCELLED
 * 
 * Guard-required transition: ANY → CANCELLED
 * Preconditions enforced by RoomCancelGuard:
 *   - User is room participant
 *   - Room not in forbidden cancel states (SWAPPED, FAILED, UNDER_VALIDATION, SWAP_READY, EXPIRED)
 *   - No active swap in progress
 *   - Cancellation reason provided (optional, max 500 chars)
 * 
 * Transition: ROOM_CANCELLED
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';
import { RoomRepository } from '../../repositories/room.repository';

interface CancelRoomInput {
  actorId: string;
  roomId: string;
  cancellationReason?: string;
}

interface CancelRoomResult {
  success: boolean;
  message: string;
  room?: any;
  transitionTimestamp: Date;
}

@Injectable()
export class RoomCancelService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly roomRepository: RoomRepository,
  ) {}

  async cancelRoom(input: CancelRoomInput): Promise<CancelRoomResult> {
    throw new Error('RoomCancelService.cancelRoom() not implemented (Iteration 2)');
  }
}
