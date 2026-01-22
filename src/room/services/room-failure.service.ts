/**
 * RoomFailureService
 * Transitions room: IN_PROGRESS → FAILED
 * Triggered by admin, participant, or system request.
 * Artifacts not released, containers locked.
 * Both containers are invalidated via saga coordination.
 * Transition: IN_PROGRESS → FAILED
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';
import { ContainerRejectService } from '../../container/services/container-reject.service';
import { RoomRepository } from '../../repositories/room.repository';
import { ContainerRepository } from '../../repositories/container.repository';

interface FailRoomInput {
  roomId: string;
  reason: string; // Failure reason (non-empty, required)
  actorId?: string; // Actor initiating failure (admin/participant/system)
  originatingService?: string; // Service that triggered this (e.g., 'ContainerRejectService')
}

interface FailRoomResult {
  success: boolean;
  message: string;
  room?: any; // TODO: Define Room entity type after Room entity creation
  containerFailures?: Array<{ containerId: string; status: 'success' | 'failed'; message: string }>;
  transitionTimestamp: Date;
}

@Injectable()
export class RoomFailureService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly roomRepository: RoomRepository,
    private readonly containerRepository: ContainerRepository,
    @Inject(forwardRef(() => ContainerRejectService))
    private readonly containerRejectService: ContainerRejectService,
  ) {}

  async failRoom(input: FailRoomInput): Promise<FailRoomResult> {
    const { roomId, reason, actorId = 'SYSTEM', originatingService = 'RoomFailureService' } = input;
    const attemptId = `${Date.now()}-${Math.random()}`;

    try {
      // ============================================================================
      // PHASE 1: PRECONDITIONS (NO MUTATION)
      // ============================================================================

      // TODO: AuditService.logAttempt()
      // Log: actor=actorId, action='room_failed', room_id=roomId, status=ATTEMPT, attemptId=attemptId
      // Expected behavior: create audit_log entry with status='ATTEMPT' before any validation

      // TODO: Validate failure_reason (non-empty, max length enforced)
      // Check: reason !== null && reason.trim().length > 0 && reason.length <= MAX_LENGTH (e.g., 1000)
      // Throw if missing, empty, or exceeds max length
      if (!reason || reason.trim().length === 0) {
        throw new Error('Failure reason must be provided and non-empty');
      }
      if (reason.length > 1000) {
        throw new Error('Failure reason exceeds maximum length (1000 characters)');
      }

      // TODO: RoomRepository.findOne(roomId)
      // Verify room exists in database; throw if not found
      const room = await this.roomRepository.findOne(roomId);
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      // TODO: Verify room.state = IN_PROGRESS
      // Check enum value; throw if not in expected state
      if (room.state !== 'IN_PROGRESS') {
        throw new Error(
          `Room ${roomId} state is ${room.state}, expected IN_PROGRESS`,
        );
      }

      // TODO: Verify actor is ADMIN or room participant
      // Check: actorId matches room.creator_id OR room.counterparty_id, or actor has ADMIN role
      // For now, assume validation is done by guard
      const isValidActor = true; // TODO: Implement actual authorization check
      if (!isValidActor) {
        throw new Error(`Actor ${actorId} is not authorized to fail room ${roomId}`);
      }

      // TODO: AuditService.checkIdempotency()
      // Query audit_log for: actor_id=actorId, action='room_failed', room_id=roomId,
      //                      status=TRANSITION, within last 5 min bucket
      // Idempotency key format: actor_id:room_failed:{room_id}:bucket_5min
      // If found, return early with success (idempotent response)
      // Expected behavior: prevent duplicate failures within 5-minute window per actor
      const isIdempotent = false; // TODO: Replace with actual idempotency check result
      if (isIdempotent) {
        return {
          success: true,
          message: 'Room failure already processed (idempotent)',
          room: room,
          containerFailures: [],
          transitionTimestamp: new Date(),
        };
      }

      // ============================================================================
      // PHASE 2: ATOMIC TRANSACTION (ROOM)
      // ============================================================================

      // TODO: Begin database transaction (if using transaction manager)
      // Expected behavior: all operations below must succeed or rollback together

      // TODO: RoomRepository.update(roomId, {
      //        state: 'FAILED',
      //        failure_reason: reason,
      //        failed_at: NOW(),
      //        updated_at: NOW()
      //      })
      // Update room.state to 'FAILED', set failure reason and failed_at timestamp
      // Expected behavior: atomic update, committed to database

      const failedRoom = await this.roomRepository.update(roomId, {
        state: 'FAILED',
        failure_reason: reason,
        failed_at: new Date(),
      });

      // TODO: AuditService.logTransition()
      // Log: actor_id=actorId, action='room_failed', room_id=roomId, status=TRANSITION,
      //      transition='IN_PROGRESS → FAILED', attemptId=attemptId, failure_reason=reason, timestamp=NOW()
      // Expected behavior: create immutable audit_log entry with transition details

      // TODO: Commit transaction
      // Expected behavior: room state change is persisted atomically
      // IMPORTANT: After this commit, room is FAILED and will NOT be rolled back
      //            even if container rejection cascade encounters errors

      const containerFailures: Array<{
        containerId: string;
        status: 'success' | 'failed';
        message: string;
      }> = [];

      // ============================================================================
      // PHASE 3: COORDINATED SIDE EFFECT (SAGA, ISOLATED)
      // ============================================================================

      // This phase occurs AFTER room commit. Failures here do NOT roll back room failure.
      // Each container is rejected in separate transactions (saga pattern).

      // TODO: ContainerRepository.findByRoomId(roomId)
      // Query all containers in this room
      const containers = await this.containerRepository.findByRoomId(roomId);

      // Reject both containers (creator and counterparty containers)
      for (const container of containers) {
        try {
          // TODO: ContainerRejectService.rejectContainer()
          // Invoke container rejection for this container
          // Parameters: adminId='SYSTEM', containerId=container.id, rejectionReason=reason
          // Expected behavior: container transitions to VALIDATION_FAILED in separate transaction
          const rejectResult = await this.containerRejectService.rejectContainer({
            adminId: 'SYSTEM', // Room failure is system-initiated
            containerId: container.id,
            rejectionReason: `Room failure: ${reason}`,
          });

          containerFailures.push({
            containerId: container.id,
            status: 'success',
            message: `Container rejected: ${rejectResult.message}`,
          });
        } catch (error) {
          // TODO: AuditService.logFailure() [for saga phase]
          // Log: actor_id='SYSTEM', action='container_rejection_saga', container_id=container.id,
          //      status=SAGA_FAILURE, error_message=error.message
          // Expected behavior: record that container rejection failed in saga

          containerFailures.push({
            containerId: container.id,
            status: 'failed',
            message: `Container rejection failed: ${(error as Error).message}`,
          });

          console.error(
            `Container rejection failed for container ${container.id} during room failure cascade:`,
            error,
          );
          // NOTE: Do NOT throw here. Room is already committed. Saga failure is logged.
        }
      }

      // ============================================================================
      // PHASE 4: ASYNC SIDE EFFECTS
      // ============================================================================

      // TODO: NotificationService.sendRoomFailureNotification()
      // Notify both room participants that room has failed
      // Fire-and-forget: do NOT await, do NOT block on result
      // Parameters: room=failedRoom, reason=reason, containers=containers
      // Expected behavior: async notification sent, function returns immediately
      this.notificationService
        .sendRoomFailureNotification({ room: failedRoom, reason: reason })
        .catch((error) => {
          // TODO: Log error for monitoring; do NOT throw
          console.error(`Notification failed for room ${roomId}:`, error);
        });

      return {
        success: true,
        message: `Room ${roomId} failed successfully`,
        room: failedRoom,
        containerFailures: containerFailures,
        transitionTimestamp: new Date(),
      };
    } catch (error) {
      // TODO: AuditService.logFailure()
      // Log: actor_id=actorId, action='room_failed', room_id=roomId, status=FAILURE,
      //      error_message=error.message, attemptId=attemptId
      // Expected behavior: immutable record of failed attempt with error reason

      throw error;
    }
  }
}
