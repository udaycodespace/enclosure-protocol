/**
 * RoomController
 * User-initiated endpoints for room state transitions.
 * Injects all 9 services and all 9 guards for routing requests to appropriate handlers.
 */

import { Controller } from '@nestjs/common';
import { RoomInviteService } from './services/room-invite.service';
import { RoomJoinService } from './services/room-join.service';
import { RoomLockService } from './services/room-lock.service';
import { RoomProgressService } from './services/room-progress.service';
import { RoomValidationStartService } from './services/room-validation-start.service';
import { RoomSwapApprovalService } from './services/room-swap-approval.service';
import { AtomicSwapExecutionService } from './services/atomic-swap-execution.service';
import { RoomFailureService } from './services/room-failure.service';
import { RoomExpiryService } from './services/room-expiry.service';

import { CreatorRoomInviteGuard } from './guards/creator-room-invite.guard';
import { CounterpartyRoomJoinGuard } from './guards/counterparty-room-join.guard';
import { ParticipantRoomLockGuard } from './guards/participant-room-lock.guard';
import { SystemRoomProgressGuard } from './guards/system-room-progress.guard';
import { ParticipantRoomValidationStartGuard } from './guards/participant-room-validation-start.guard';
import { AdminRoomSwapApprovalGuard } from './guards/admin-room-swap-approval.guard';
import { SystemAtomicSwapGuard } from './guards/system-atomic-swap.guard';
import { RoomFailureGuard } from './guards/room-failure.guard';
import { SystemRoomExpiryGuard } from './guards/system-room-expiry.guard';

@Controller('rooms')
export class RoomController {
  constructor(
    private readonly roomInviteService: RoomInviteService,
    private readonly roomJoinService: RoomJoinService,
    private readonly roomLockService: RoomLockService,
    private readonly roomProgressService: RoomProgressService,
    private readonly roomValidationStartService: RoomValidationStartService,
    private readonly roomSwapApprovalService: RoomSwapApprovalService,
    private readonly atomicSwapExecutionService: AtomicSwapExecutionService,
    private readonly roomFailureService: RoomFailureService,
    private readonly roomExpiryService: RoomExpiryService,

    private readonly creatorRoomInviteGuard: CreatorRoomInviteGuard,
    private readonly counterpartyRoomJoinGuard: CounterpartyRoomJoinGuard,
    private readonly participantRoomLockGuard: ParticipantRoomLockGuard,
    private readonly systemRoomProgressGuard: SystemRoomProgressGuard,
    private readonly participantRoomValidationStartGuard: ParticipantRoomValidationStartGuard,
    private readonly adminRoomSwapApprovalGuard: AdminRoomSwapApprovalGuard,
    private readonly systemAtomicSwapGuard: SystemAtomicSwapGuard,
    private readonly roomFailureGuard: RoomFailureGuard,
    private readonly systemRoomExpiryGuard: SystemRoomExpiryGuard,
  ) {}

  // TODO: Implement room endpoints (@Post, @Put, etc.) with @UseGuards() decorators
}
