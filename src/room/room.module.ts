/**
 * RoomModule
 * Manages room aggregate lifecycle through 9 state transitions.
 * Dependencies: PaymentModule (forwardRef), AuditModule, NotificationModule, AIModule, ContainerModule (forwardRef), StorageModule
 */

import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentModule } from '../payment/payment.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { AIModule } from '../ai/ai.module';
import { ContainerModule } from '../container/container.module';
import { StorageModule } from '../storage/storage.module';

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

import { RoomExpiryJob } from './jobs/room-expiry.job';
import { RoomProgressJob } from './jobs/room-progress.job';
import { SwapExecutionJob } from './jobs/swap-execution.job';

import { RoomController } from './room.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => PaymentModule),
    AuditModule,
    NotificationModule,
    AIModule,
    forwardRef(() => ContainerModule),
    StorageModule,
  ],
  providers: [
    RoomInviteService,
    RoomJoinService,
    RoomLockService,
    RoomProgressService,
    RoomValidationStartService,
    RoomSwapApprovalService,
    AtomicSwapExecutionService,
    RoomFailureService,
    RoomExpiryService,

    CreatorRoomInviteGuard,
    CounterpartyRoomJoinGuard,
    ParticipantRoomLockGuard,
    SystemRoomProgressGuard,
    ParticipantRoomValidationStartGuard,
    AdminRoomSwapApprovalGuard,
    SystemAtomicSwapGuard,
    RoomFailureGuard,
    SystemRoomExpiryGuard,

    RoomExpiryJob,
    RoomProgressJob,
    SwapExecutionJob,
  ],
  controllers: [RoomController],
  exports: [
    RoomInviteService,
    RoomJoinService,
    RoomLockService,
    RoomProgressService,
    RoomValidationStartService,
    RoomSwapApprovalService,
    AtomicSwapExecutionService,
    RoomFailureService,
    RoomExpiryService,

    CreatorRoomInviteGuard,
    CounterpartyRoomJoinGuard,
    ParticipantRoomLockGuard,
    SystemRoomProgressGuard,
    ParticipantRoomValidationStartGuard,
    AdminRoomSwapApprovalGuard,
    SystemAtomicSwapGuard,
    RoomFailureGuard,
    SystemRoomExpiryGuard,
  ],
})
export class RoomModule {}