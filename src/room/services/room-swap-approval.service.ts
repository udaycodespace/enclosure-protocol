/**
 * RoomSwapApprovalService
 * Transitions room: UNDER_VALIDATION → SWAP_READY
 * Admin-only operation with approval reason.
 * Both containers must have validation_summary indicating approval.
 * Transition: UNDER_VALIDATION → SWAP_READY
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ContainerApproveService } from '../../container/services/container-approve.service';
import { RoomRepository } from '../../repositories/room.repository';
import { ContainerRepository } from '../../repositories/container.repository';

interface ApproveSwapInput {
  adminId: string;
  roomId: string;
  approvalReason: string; // Required, non-empty admin decision notes
}

interface ApproveSwapResult {
  success: boolean;
  message: string;
  room?: any; // TODO: Define Room entity type after Room entity creation
  containerApprovals?: Array<{ containerId: string; status: 'success' | 'failed'; message: string }>;
  transitionTimestamp: Date;
}

@Injectable()
export class RoomSwapApprovalService {
  constructor(
    private readonly auditService: AuditService,
    private readonly roomRepository: RoomRepository,
    private readonly containerRepository: ContainerRepository,
    @Inject(forwardRef(() => ContainerApproveService))
    private readonly containerApproveService: ContainerApproveService,
  ) {}

  async approveSwap(input: ApproveSwapInput): Promise<ApproveSwapResult> {
    const { adminId, roomId, approvalReason } = input;
    const attemptId = `${Date.now()}-${Math.random()}`;

    try {
      // ============================================================================
      // PHASE 1: PRECONDITIONS (NO MUTATION)
      // ============================================================================

      // TODO: AuditService.logAttempt()
      // Log: actor=adminId, action='room_swap_approval', room_id=roomId, status=ATTEMPT, attemptId=attemptId
      // Expected behavior: create audit_log entry with status='ATTEMPT' before any validation

      // TODO: Verify actor has ADMIN role
      // Check JWT token claims for admin role; throw if not admin
      // For now, assume valid admin caller (guard enforces this)
      const callerRole = 'ADMIN'; // TODO: Get from JWT request context
      if (callerRole !== 'ADMIN') {
        throw new Error(
          `Room swap approval requires ADMIN role, got ${callerRole}`,
        );
      }

      // TODO: Validate approval_reason (required, non-empty)
      // Check: approvalReason !== null && approvalReason.trim().length > 0
      // Throw if missing or empty
      if (!approvalReason || approvalReason.trim().length === 0) {
        throw new Error('Approval reason must be provided and non-empty');
      }

      // TODO: RoomRepository.findOne(roomId)
      // Verify room exists in database; throw if not found
      const room = await this.roomRepository.findOne(roomId);
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      // TODO: Verify room.state = UNDER_VALIDATION
      // Check enum value; throw if not in expected state
      if (room.state !== 'UNDER_VALIDATION') {
        throw new Error(
          `Room ${roomId} state is ${room.state}, expected UNDER_VALIDATION`,
        );
      }

      // TODO: ContainerRepository.findByRoomId(roomId)
      // Fetch both containers for this room (creator and counterparty)
      const containers = await this.containerRepository.findByRoomId(roomId);
      if (containers.length !== 2) {
        throw new Error(
          `Room ${roomId} must have exactly 2 containers, found ${containers.length}`,
        );
      }

      // TODO: Verify BOTH containers:
      // - state = UNDER_VALIDATION
      // - validation_summary EXISTS (AI or manual validation completed)
      // Throw if any container fails validation
      for (const container of containers) {
        if (container.state !== 'UNDER_VALIDATION') {
          throw new Error(
            `Container ${container.id} state is ${container.state}, expected UNDER_VALIDATION`,
          );
        }
        if (!container.validation_summary) {
          throw new Error(
            `Container ${container.id} has no validation_summary. AI analysis must complete first.`,
          );
        }
      }

      // TODO: AuditService.checkIdempotency()
      // Query audit_log for: actor_id=adminId, action='room_swap_approval', room_id=roomId,
      //                      status=TRANSITION, within last 5 min bucket
      // Idempotency key format: admin_id:room_swap_approval:{room_id}:bucket_5min
      // If found, return early with success (idempotent response)
      // Expected behavior: prevent duplicate approvals within 5-minute window per admin
      const isIdempotent = false; // TODO: Replace with actual idempotency check result
      if (isIdempotent) {
        return {
          success: true,
          message: 'Room swap approval already processed (idempotent)',
          room: room,
          containerApprovals: [],
          transitionTimestamp: new Date(),
        };
      }

      // ============================================================================
      // PHASE 2: ATOMIC TRANSACTION (ROOM)
      // ============================================================================

      // TODO: Begin database transaction (if using transaction manager)
      // Expected behavior: all operations below must succeed or rollback together

      // TODO: RoomRepository.update(roomId, {
      //        state: 'SWAP_READY',
      //        approved_by: adminId,
      //        approval_reason: approvalReason,
      //        approved_at: NOW(),
      //        updated_at: NOW()
      //      })
      // Update room.state to 'SWAP_READY', record admin approval details and timestamp
      // Expected behavior: atomic update, committed to database

      const approvedRoom = await this.roomRepository.update(roomId, {
        state: 'SWAP_READY',
        approved_by: adminId,
        approval_reason: approvalReason,
        approved_at: new Date(),
      });

      if (!approvedRoom) {
        throw new Error(`Failed to update room ${roomId} to SWAP_READY state`);
      }

      // TODO: AuditService.logTransition()
      // Log: actor_id=adminId, action='room_swap_approval', room_id=roomId, status=TRANSITION,
      //      transition='UNDER_VALIDATION → SWAP_READY', attemptId=attemptId,
      //      approval_reason=approvalReason, validation_hashes=[container validation_summary hashes],
      //      timestamp=NOW()
      // Expected behavior: create immutable audit_log entry with transition details (NO raw artifacts)
      // IMPORTANT: Audit should log hashes/summaries, not raw artifact data

      // TODO: Commit transaction
      // Expected behavior: room state change is persisted atomically
      // IMPORTANT: After this commit, room is SWAP_READY and will NOT be rolled back
      //            even if container approval cascade encounters errors

      const containerApprovals: Array<{
        containerId: string;
        status: 'success' | 'failed';
        message: string;
      }> = [];

      // ============================================================================
      // PHASE 3: COORDINATED SIDE EFFECT (SAGA)
      // ============================================================================

      // This phase occurs AFTER room commit. Failures here do NOT roll back room state.
      // Each container is approved in separate transactions (saga pattern).
      // Transition: UNDER_VALIDATION → VALIDATED

      for (const container of containers) {
        try {
          // TODO: ContainerApproveService.approveContainer()
          // Invoke container approval for this container
          // Parameters: adminId=adminId, containerId=container.id,
          //             validationSummary=approvalReason (admin decision propagated)
          // Expected behavior: container transitions to VALIDATED in separate transaction
          const approveResult = await this.containerApproveService.approveContainer({
            adminId: adminId,
            containerId: container.id,
            validationSummary: `Swap approved by admin: ${approvalReason}`,
          });

          containerApprovals.push({
            containerId: container.id,
            status: 'success',
            message: `Container approved: ${approveResult.message}`,
          });
        } catch (error) {
          // TODO: AuditService.logFailure() [for saga phase]
          // Log: actor_id=adminId, action='container_approval_saga', container_id=container.id,
          //      status=SAGA_FAILURE, error_message=error.message
          // Expected behavior: record that container approval failed in saga
          // ALERT ADMIN: Container approval failed but room state is SWAP_READY

          containerApprovals.push({
            containerId: container.id,
            status: 'failed',
            message: `Container approval failed: ${(error as Error).message}`,
          });

          console.error(
            `Container approval failed for container ${container.id} during swap approval cascade:`,
            error,
          );
          // NOTE: Do NOT throw here. Room is already committed to SWAP_READY. 
          // Saga failure is logged and admin must be alerted for manual intervention.
        }
      }

      return {
        success: true,
        message: `Room ${roomId} approved for swap`,
        room: approvedRoom,
        containerApprovals: containerApprovals,
        transitionTimestamp: new Date(),
      };
    } catch (error) {
      // TODO: AuditService.logFailure()
      // Log: actor_id=adminId, action='room_swap_approval', room_id=roomId, status=FAILURE,
      //      error_message=error.message, attemptId=attemptId
      // Expected behavior: immutable record of failed attempt with error reason

      throw error;
    }
  }
}
