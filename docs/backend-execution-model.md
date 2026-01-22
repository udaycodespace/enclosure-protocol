# ENCLOSURE BACKEND EXECUTION MODEL
## NestJS Service Orchestration Contract

This document specifies HOW transitions defined in UDAY.txt are executed by NestJS services.
This is an **internal engineering contract**, not user-facing specification.

---

## EXECUTION MODEL PRINCIPLES

### Authority Separation
- **Guards**: Permission enforcement ONLY (no mutation, no state change)
- **Services**: State transition execution + side effects
- **System Jobs**: Scheduled/async operations (distinct code paths from user-initiated flows)
- **Webhooks**: External system confirmations (Razorpay, virus scan) → trigger services, never directly mutate

### Transactionality
- **Single Aggregate Root Per Transaction**: Service may NOT mutate Room + Container in same transaction
- **Saga Pattern**: Multi-step transitions use orchestrated services with compensating actions
- **Idempotency**: All operations are replay-safe with stable idempotency keys
- **Atomicity**: Specific steps marked [ATOMIC] must complete or roll back entirely

### Auditability
- **Before Guard Execution**: Attempt logged (who, when, what permission checked)
- **After Service Execution**: Result logged (state change, side effects, errors)
- **Webhook Arrival**: Every external confirmation logged with timestamp and payload hash
- **No Erasure**: Audit table is APPEND-ONLY at database level (enforced by triggers)

### Replay Safety
- **Idempotency Keys**: Generated from (actor_id, transition_type, room_id, timestamp_bucket_5min)
- **Duplicate Detection**: Incoming request checked against recent audit log before execution
- **Side Effect Ordering**: Services call dependencies in stable order; dependencies check for prior execution via audit log

---

## ROOM STATE TRANSITIONS

---

### TRANSITION 1: ROOM_CREATED → INVITE_SENT

**SERVICE**: RoomInviteService

**CALL ORDER**:
1. Guard validates (CreatorRoomInviteGuard)
2. RoomInviteService.initiateInvite() called
   - Depends on: AuditService, NotificationService

**DEPENDENCIES**:
- **AuditService**: Log attempt, then result
- **NotificationService**: Send confirmation email to creator (async, non-blocking)
- **Database**: Single transaction on rooms table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Insert room record with state=ROOM_CREATED
- Compute requirements_hash (SHA-256) at application level, store in DB
- Set state → INVITE_SENT
- Commit
- If rollback: audit logged as "failed attempt"

**ASYNC STEPS**:
- [ ] NotificationService.sendCreatorConfirmation() — async, fire-and-forget
  - Failure does not roll back transaction
  - Retry up to 3 times with exponential backoff (5s, 25s, 125s)

**IDEMPOTENCY**:
- Key: `creator_id:room_created_invite:bucket_5min`
- Check audit log: if (actor=creator_id AND action=room.invite_sent) within last 5 min → return 409 Conflict
- Prevents duplicate room creation

**RETRY BEHAVIOR**:
- User can retry after 15 seconds if network timeout
- Audit log shows retry with same idempotency key
- No duplicate room created

**ATOMIC GUARANTEES**:
- [ATOMIC] Room inserted AND state transitioned and requirements_hash computed in single DB transaction
- If compute fails, rollback entire operation

---

### TRANSITION 2: INVITE_SENT → JOINED

**SERVICE**: RoomJoinService

**CALL ORDER**:
1. Guard validates (CounterpartyRoomJoinGuard)
2. RoomJoinService.joinRoom() called
   - Depends on: AuditService, NotificationService, ContainerService

**DEPENDENCIES**:
- **AuditService**: Log attempt, result, and any conflicts
- **ContainerService**: Fetch room's containers (read-only)
- **NotificationService**: Notify creator party that counterparty joined (async)
- **Database**: Single transaction on rooms table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- [ATOMIC] Update rooms: set client_id OR freelancer_id to joiner, state → JOINED
- Use row lock on rooms table (SELECT FOR UPDATE)

**ASYNC STEPS**:
- [ ] NotificationService.sendCounterpartyJoinedAlert() to creator
  - Retry 3x, exponential backoff
  - Failure does not roll back transaction

**IDEMPOTENCY**:
- Key: `joiner_id:room_joined:{room_id}:bucket_5min`
- If actor attempted JOIN on same room within 5 min → check audit log
- If successful join found → return 200 OK (no-op, not 409)

**RETRY BEHAVIOR**:
- User retry allowed after 15 seconds
- Audit log shows retry attempt with same key
- DB row lock prevents race condition (one wins, other gets 409)

**ATOMIC GUARANTEES**:
- [ATOMIC] Room state AND participant assignment must succeed together
- If either fails, entire transaction rolls back

**EDGE CASE HANDLING**:
- Two joiners simultaneously → row lock serializes
- First acquires lock, second waits, first releases, second acquires
- Second joiner sees room already in JOINED → 409 Conflict

---

### TRANSITION 3: JOINED → LOCKED

**SERVICE**: RoomLockService

**CALL ORDER**:
1. Guard validates OTP freshness (ParticipantRoomLockGuard)
2. RoomLockService.lockRoom() called
   - Depends on: PaymentService, AuditService, NotificationService

**DEPENDENCIES**:
- **PaymentService**: Verify/create payment record, call Razorpay API
- **AuditService**: Log attempt and result
- **NotificationService**: Async notification to both parties
- **Database**: Transactions on rooms and payments tables (separate transactions)

**TRANSACTION BOUNDARY**: Two transactions (saga pattern)

**TRANSACTION 1** [ATOMIC]:
- Verify requirements_hash unchanged (immutability check)
- Update room: state → LOCKED
- Commit

**TRANSACTION 2** [ATOMIC]:
- If payment.status = PENDING: call PaymentService.capturePayment()
  - PaymentService.createRazorpayOrder()
  - Update payments: status → PENDING (idempotent, no duplicate orders)
  - Commit
- If payment already CONFIRMED: skip

**ASYNC STEPS**:
- [ ] PaymentService.capturePayment() is async, non-blocking
  - Returns order_id to client immediately
  - Client handles webhook from Razorpay asynchronously
  - If capture fails: PaymentService logs error, NotificationService notifies user
  - Retry: automatic, via webhook retry logic (Razorpay)

**IDEMPOTENCY**:
- Key: `actor_id:room_locked:{room_id}:bucket_5min`
- Check audit log for successful LOCK attempt
- Return 200 OK if found (side effects already triggered)

**RETRY BEHAVIOR**:
- User can retry after 30 seconds if timeout
- PaymentService checks if order_id already exists (via Razorpay API)
- If exists: update payments table with same order_id (no duplicate charge)
- If not: create new order

**ATOMIC GUARANTEES**:
- [ATOMIC] Room.state → LOCKED completes, OR rolls back entirely
- [ATOMIC] Payment record created with initial status, OR rolls back entirely
- If either transaction fails: audit logged, user directed to retry

---

### TRANSITION 4: LOCKED → IN_PROGRESS

**SERVICE**: RoomProgressService

**CALL ORDER**:
1. Guard validates (SystemRoomProgressGuard) — system-triggered OR admin override
2. RoomProgressService.moveToProgress() called
   - Depends on: AuditService, NotificationService, ContainerService

**DEPENDENCIES**:
- **AuditService**: Log system action with reason (if admin override)
- **NotificationService**: Notify both parties async
- **ContainerService**: Fetch both containers (read-only verify state=EMPTY)
- **Database**: Transaction on rooms table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Verify all payments CONFIRMED (read-only check)
- Verify both containers exist with state=EMPTY
- Update room: state → IN_PROGRESS
- Commit

**ASYNC STEPS**:
- [ ] NotificationService.broadcastRoomInProgress() to both parties
  - Retry 3x exponential backoff
  - Failure does not roll back

**IDEMPOTENCY**:
- Key: `system:room_progress:{room_id}:bucket_5min`
- Check audit log: if action=room.in_progress within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- System job scheduled to execute every 1 minute
- Each invocation checks idempotency key
- Max 1 execution per room per 5 min window

**ATOMIC GUARANTEES**:
- [ATOMIC] Room.state → IN_PROGRESS, OR entire operation fails
- Payment confirmation verified before state change (no partial progress)

---

### TRANSITION 5: IN_PROGRESS → UNDER_VALIDATION

**SERVICE**: RoomValidationStartService

**CALL ORDER**:
1. Guard validates (ParticipantRoomValidationStartGuard)
2. RoomValidationStartService.startValidation() called
   - Depends on: AuditService, AIService, ContainerService, NotificationService

**DEPENDENCIES**:
- **AuditService**: Log transition attempt and result
- **ContainerService**: Verify both containers state=SEALED, fetch artifacts
- **AIService**: Async AI analysis request (read-only, non-blocking)
- **NotificationService**: Notify admin validation required async
- **Database**: Transactions on rooms and containers tables (separate)

**TRANSACTION BOUNDARY**: Two transactions (saga)

**TRANSACTION 1** [ATOMIC]:
- Verify both containers state=SEALED and have artifacts
- Update room: state → UNDER_VALIDATION
- Commit

**TRANSACTION 2** [ATOMIC]:
- Update both containers: state → UNDER_VALIDATION
- Commit

**ASYNC STEPS**:
- [ ] AIService.requestAnalysis() — async, read-only
  - Pass container IDs and artifact metadata (NO artifact content on first call)
  - AI service fetches artifacts from Supabase, runs analysis
  - AI service calls webhook: AIService.onAnalysisComplete()
  - Analysis result stored in containers.validation_details (JSONB)
  - Failure: log error, allow manual retry, do NOT roll back room state

**IDEMPOTENCY**:
- Key: `actor_id:room_validation_start:{room_id}:bucket_5min`
- Check audit log for successful transition
- Return 200 OK if found

**RETRY BEHAVIOR**:
- User can retry after 20 seconds if AI service timeout
- AI analysis itself is idempotent (same artifact IDs → same analysis)

**ATOMIC GUARANTEES**:
- [ATOMIC] Room and both Containers state transitioned together, OR all rolled back
- AI analysis failure is isolated (does not roll back state change)

---

### TRANSITION 6: UNDER_VALIDATION → SWAP_READY

**SERVICE**: RoomSwapApprovalService

**CALL ORDER**:
1. Guard validates admin role (AdminRoomSwapApprovalGuard)
2. RoomSwapApprovalService.approveSwap() called
   - Depends on: AuditService, ContainerService

**DEPENDENCIES**:
- **AuditService**: Log admin approval with reason and validation details
- **ContainerService**: Verify both containers state=UNDER_VALIDATION and have validation_summary
- **Database**: Transaction on rooms and containers tables (separate)

**TRANSACTION BOUNDARY**: Two transactions (saga)

**TRANSACTION 1** [ATOMIC]:
- Verify both containers have validation_summary (AI or manual)
- Update room: state → SWAP_READY
- Audit log: include admin_id, approval_reason, validation_details from both containers
- Commit

**TRANSACTION 2** [ATOMIC]:
- Update both containers: state → VALIDATED
- Commit

**ASYNC STEPS**:
- None (synchronous admin action)

**IDEMPOTENCY**:
- Key: `admin_id:room_swap_approval:{room_id}:bucket_5min`
- Check audit log: if admin_id performed SWAP_READY transition → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- Admin can retry after 10 seconds if transient error
- No duplicate audit entries created (idempotency key prevents)

**ATOMIC GUARANTEES**:
- [ATOMIC] Room and both Containers state transitioned together
- Reason recorded in audit trail (immutable)

---

### TRANSITION 7: SWAP_READY → SWAPPED

**SERVICE**: AtomicSwapExecutionService

**CALL ORDER**:
1. Guard validates system execution (SystemAtomicSwapGuard)
2. AtomicSwapExecutionService.executeSwap() called
   - Depends on: StorageService, PaymentService, AuditService, NotificationService

**DEPENDENCIES**:
- **StorageService**: Move artifacts from containers to owners' storage (Supabase)
- **PaymentService**: Release final balance via Razorpay
- **AuditService**: Log swap execution and all side effects
- **NotificationService**: Notify both parties async with completion summary
- **Database**: Multi-table transaction (rooms, containers, payments)

**TRANSACTION BOUNDARY**: Multi-step saga with compensating actions

**STEP 1** [ATOMIC]:
- Verify: Room.state=SWAP_READY, Container_A/B.state=VALIDATED, all payments=CONFIRMED
- Verify: Files exist in Supabase Storage for both containers
- Audit log: "swap.executing"

**STEP 2** (Async, with Rollback):
- StorageService.moveArtifacts():
  - Copy Container_A artifacts → Client's storage prefix
  - Copy Container_B artifacts → Freelancer's storage prefix
  - If either fails: log error, ABORT entire swap, stay in SWAP_READY, alert Admin
  - If both succeed: proceed to STEP 3

**STEP 3** (Async, with Rollback):
- PaymentService.releaseBalance():
  - Create new payment record: type=FINAL_BALANCE_RELEASE
  - Call Razorpay API to release remaining balance to Freelancer
  - If fails: log error, ABORT entire swap, stay in SWAP_READY, alert Admin
  - If succeeds: proceed to STEP 4

**STEP 4** [ATOMIC]:
- Update room: state → SWAPPED
- Update containers: state → TRANSFERRED
- Mark all payments: status=FINAL (no further refunds)
- Commit
- If commit fails: swap is INCOMPLETE, alert Admin for manual review

**ASYNC STEPS**:
- [ ] NotificationService.sendSwapCompleted() to both parties
  - Includes high-level summary only (no identity revealed)
  - Retry 3x exponential backoff

**IDEMPOTENCY**:
- Key: `system:swap_executed:{room_id}:bucket_5min`
- Check audit log: if "swap.executing" found within 5 min → return 200 OK or check for completion
- If SWAPPED state already set → return 200 OK (entire swap already completed)
- If SWAP_READY and no execution log: retry

**RETRY BEHAVIOR**:
- System job retries every 2 minutes if swap failed
- STEP 2 (artifacts): Supabase operations are idempotent (copy same source → destination is no-op)
- STEP 3 (payment): Razorpay creates idempotent charge based on request ID (no duplicate)
- If STEP 4 (DB update) fails: alert Admin, manual intervention required

**ATOMIC GUARANTEES**:
- [ATOMIC] STEP 1: All preconditions verified before any mutation
- [ATOMIC] STEP 4: Room/Container state change in single transaction, OR entire swap aborts
- Compensating action: If any step fails, swap remains in SWAP_READY (safe for retry)

**FAILURE ISOLATION**:
- Storage failure: swap aborts BEFORE payment release (money not lost)
- Payment failure: swap aborts, storage moves rolled back (artifacts returned via manual recovery)
- DB failure: swap incomplete, Admin alerted for manual intervention

---

### TRANSITION 8: IN_PROGRESS → FAILED

**SERVICE**: RoomFailureService

**CALL ORDER**:
1. Guard validates (RoomFailureGuard) — Admin or participant
2. RoomFailureService.failRoom() called
   - Depends on: AuditService, NotificationService, ContainerService

**DEPENDENCIES**:
- **AuditService**: Log failure with reason and actor
- **ContainerService**: Update both containers state
- **NotificationService**: Notify both parties async (high-level summary)
- **Database**: Transactions on rooms and containers tables

**TRANSACTION BOUNDARY**: Two transactions (saga)

**TRANSACTION 1** [ATOMIC]:
- Update room: state → FAILED, failure_reason = provided
- Commit

**TRANSACTION 2** [ATOMIC]:
- Update both containers: state → VALIDATION_FAILED
- Commit

**ASYNC STEPS**:
- [ ] NotificationService.sendFailureNotification() to both parties
  - No identity revealed
  - Retry 3x exponential backoff

**IDEMPOTENCY**:
- Key: `actor_id:room_failed:{room_id}:bucket_5min`
- Check audit log: if action=room.failed within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- User can retry after 10 seconds if network error
- Idempotency key prevents duplicate failure entries

**ATOMIC GUARANTEES**:
- [ATOMIC] Room and both Containers state transitioned together
- Reason immutably recorded in audit trail

---

### TRANSITION 9: INVITE_SENT → EXPIRED

**SERVICE**: RoomExpiryService

**CALL ORDER**:
1. Guard validates (SystemRoomExpiryGuard) — system job only
2. RoomExpiryService.expireRoom() called
   - Depends on: AuditService, NotificationService

**DEPENDENCIES**:
- **AuditService**: Log expiration
- **NotificationService**: Notify creator async
- **Database**: Transaction on rooms table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Verify room.expires_at <= NOW()
- Update room: state → EXPIRED
- Commit

**ASYNC STEPS**:
- [ ] NotificationService.sendExpirationNotice() to creator
  - Retry 3x exponential backoff

**IDEMPOTENCY**:
- Key: `system:room_expired:{room_id}:bucket_5min`
- Check audit log: if action=room.expired within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- System job scheduled: runs every 5 minutes
- Queries: SELECT * FROM rooms WHERE state='INVITE_SENT' AND expires_at <= NOW()
- Each room processed once per 5 min window (idempotency)

**ATOMIC GUARANTEES**:
- [ATOMIC] Room state → EXPIRED in single DB operation

---

## CONTAINER STATE TRANSITIONS

---

### TRANSITION 10: EMPTY → ARTIFACT_PLACED

**SERVICE**: ContainerArtifactUploadService

**CALL ORDER**:
1. Guard validates ownership (ContainerOwnerArtifactUploadGuard)
2. ContainerArtifactUploadService.uploadArtifacts() called
   - Depends on: StorageService, VirusScanService, AuditService

**DEPENDENCIES**:
- **StorageService**: Upload files to Supabase Storage (async, blocking for response)
- **VirusScanService**: Async virus scan per artifact
- **AuditService**: Log upload attempt and result
- **Database**: Transaction on containers and artifacts tables

**TRANSACTION BOUNDARY**: Two phases (saga)

**PHASE 1: Upload & Artifact Record** [ATOMIC]:
- For each file:
  - Call StorageService.uploadFile() (blocking)
  - Compute file_hash (SHA-256) at application level
  - Insert artifact record: file_path, file_hash, is_scanned=FALSE, is_infected=FALSE
- Update container: state → ARTIFACT_PLACED
- Commit

**PHASE 2: Virus Scan** (Async, Non-Blocking):
- For each artifact:
  - Call VirusScanService.scanArtifact() (async)
  - VirusScanService calls external API (VirusTotal or similar)
  - On scan complete: VirusScanService.onScanComplete() webhook
    - Update artifact: is_scanned=TRUE, is_infected=result
    - If infected: mark artifact, notify uploader async
    - Audit log: scan result

**ASYNC STEPS**:
- [ ] VirusScanService.scanArtifact() per artifact
  - Async, fire-and-forget after PHASE 1
  - Virus scan failure does not roll back state change
  - Allows user to retry scan or proceed with caution

**IDEMPOTENCY**:
- Key: `uploader_id:artifact_upload:{container_id}:bucket_5min`
- Check audit log: if artifacts uploaded by same uploader within 5 min → check for duplicates
- Duplicate file_hash within container → skip re-upload, link existing artifact

**RETRY BEHAVIOR**:
- User can retry upload after 30 seconds if Supabase timeout
- StorageService checks if file already at destination path (no duplicate upload)
- If partial upload (3 of 5 files fail): entire transaction rolls back (PHASE 1)

**ATOMIC GUARANTEES**:
- [ATOMIC] All artifact records inserted AND container state changed, OR all rolled back (PHASE 1)
- Virus scan is isolated and can fail without rolling back state (PHASE 2)

---

### TRANSITION 11: ARTIFACT_PLACED → SEALED

**SERVICE**: ContainerSealService

**CALL ORDER**:
1. Guard validates ownership (ContainerOwnerSealGuard)
2. ContainerSealService.sealContainer() called
   - Depends on: AuditService, NotificationService

**DEPENDENCIES**:
- **AuditService**: Log seal action
- **NotificationService**: Notify counterparty async
- **Database**: Transaction on containers table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Verify no artifacts is_infected=TRUE
- Verify all artifacts is_scanned=TRUE
- Update container: state → SEALED
- Commit

**ASYNC STEPS**:
- [ ] NotificationService.sendCounterpartySealedNotification()
  - High-level summary only
  - Retry 3x exponential backoff

**IDEMPOTENCY**:
- Key: `owner_id:container_sealed:{container_id}:bucket_5min`
- Check audit log: if action=container.sealed within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- User can retry after 10 seconds if network error
- Idempotency key prevents duplicate seals

**ATOMIC GUARANTEES**:
- [ATOMIC] Container state → SEALED after all precondition checks pass

---

### TRANSITION 12: SEALED → UNDER_VALIDATION

**SERVICE**: ContainerValidationStartService

**CALL ORDER**:
1. Guard validates (SystemContainerValidationStartGuard) — triggered by room state change
2. ContainerValidationStartService.startValidation() called
   - Depends on: AuditService

**DEPENDENCIES**:
- **AuditService**: Log transition
- **Database**: Transaction on containers table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Update container: state → UNDER_VALIDATION
- Commit

**ASYNC STEPS**:
- None (synchronous)

**IDEMPOTENCY**:
- Key: `system:container_validation_start:{container_id}:bucket_5min`
- Check audit log: if action=container.under_validation within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- System job retries if transient DB error

**ATOMIC GUARANTEES**:
- [ATOMIC] Container state → UNDER_VALIDATION

---

### TRANSITION 13: UNDER_VALIDATION → VALIDATED

**SERVICE**: ContainerApproveService

**CALL ORDER**:
1. Guard validates admin role (AdminContainerApproveGuard)
2. ContainerApproveService.approveContainer() called
   - Depends on: AuditService

**DEPENDENCIES**:
- **AuditService**: Log approval
- **Database**: Transaction on containers table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Update container: state → VALIDATED, validation_summary='APPROVED'
- Commit

**ASYNC STEPS**:
- None

**IDEMPOTENCY**:
- Key: `admin_id:container_approved:{container_id}:bucket_5min`
- Check audit log: if admin_id approved within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- Admin can retry after 10 seconds

**ATOMIC GUARANTEES**:
- [ATOMIC] Container state → VALIDATED

---

### TRANSITION 14: UNDER_VALIDATION → VALIDATION_FAILED

**SERVICE**: ContainerRejectService

**CALL ORDER**:
1. Guard validates admin role (AdminContainerRejectGuard)
2. ContainerRejectService.rejectContainer() called
   - Depends on: AuditService, RoomFailureService

**DEPENDENCIES**:
- **AuditService**: Log rejection with reason
- **RoomFailureService**: Trigger room → FAILED (saga coordination)
- **Database**: Transactions on containers and rooms tables

**TRANSACTION BOUNDARY**: Two transactions (saga)

**TRANSACTION 1** [ATOMIC]:
- Update container: state → VALIDATION_FAILED, validation_summary=reason
- Commit

**TRANSACTION 2** [ATOMIC]:
- Call RoomFailureService.failRoom() (coordinates room state change)
- Commit

**ASYNC STEPS**:
- [ ] RoomFailureService.failRoom() triggers notifications (see TRANSITION 8)

**IDEMPOTENCY**:
- Key: `admin_id:container_rejected:{container_id}:bucket_5min`
- Check audit log: if action=container.validation_failed within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- Admin can retry after 10 seconds

**ATOMIC GUARANTEES**:
- [ATOMIC] Container state → VALIDATION_FAILED, then Room state → FAILED (sequentially)

---

### TRANSITION 15: VALIDATED → TRANSFERRED

**SERVICE**: ContainerTransferService

**CALL ORDER**:
1. Guard validates (SystemContainerTransferGuard) — triggered by room swap
2. ContainerTransferService.markTransferred() called
   - Depends on: AuditService

**DEPENDENCIES**:
- **AuditService**: Log transfer
- **Database**: Transaction on containers table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Update container: state → TRANSFERRED
- Commit

**ASYNC STEPS**:
- None (artifacts already moved by AtomicSwapExecutionService)

**IDEMPOTENCY**:
- Key: `system:container_transferred:{container_id}:bucket_5min`
- Check audit log: if action=container.transferred within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- System job retries if transient error

**ATOMIC GUARANTEES**:
- [ATOMIC] Container state → TRANSFERRED

---

## PAYMENT STATE TRANSITIONS

---

### TRANSITION 16: PENDING → CONFIRMED

**SERVICE**: PaymentConfirmationService

**CALL ORDER**:
1. Guard validates webhook signature (RazorpayWebhookGuard)
2. PaymentConfirmationService.confirmPayment() called
   - Depends on: AuditService, RoomProgressService

**DEPENDENCIES**:
- **AuditService**: Log webhook arrival and confirmation
- **RoomProgressService**: Trigger room → IN_PROGRESS if auto-transition eligible (saga)
- **Database**: Transaction on payments table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Verify webhook signature (Razorpay secret)
- Verify payment_id exists in payments table
- Update payment: status → CONFIRMED, provider_payment_id, provider_order_id
- Commit

**ASYNC STEPS**:
- [ ] RoomProgressService.moveToProgress() triggered (if all payments confirmed)
  - Async, orchestrated after payment confirmation
  - May delay room transition by up to 1 minute (next system job cycle)

**IDEMPOTENCY**:
- Key: `razorpay:{provider_payment_id}:bucket_5min`
- Check audit log: if provider_payment_id already processed → return 200 OK (no-op)
- Prevents duplicate charge if Razorpay retries webhook

**RETRY BEHAVIOR**:
- Razorpay retries webhook up to 5 times with exponential backoff
- Idempotency key ensures single processing
- Backend returns 200 OK on duplicate (satisfies Razorpay retry logic)

**ATOMIC GUARANTEES**:
- [ATOMIC] Payment state → CONFIRMED in single DB operation

---

### TRANSITION 17: PENDING → FAILED

**SERVICE**: PaymentFailureService

**CALL ORDER**:
1. Guard validates webhook signature (RazorpayWebhookGuard)
2. PaymentFailureService.failPayment() called
   - Depends on: AuditService, NotificationService

**DEPENDENCIES**:
- **AuditService**: Log webhook arrival and failure reason
- **NotificationService**: Notify user async
- **Database**: Transaction on payments table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Verify webhook signature
- Verify payment_id exists
- Update payment: status → FAILED, failure_reason
- Commit

**ASYNC STEPS**:
- [ ] NotificationService.sendPaymentFailedNotification()
  - Retry 3x exponential backoff

**IDEMPOTENCY**:
- Key: `razorpay:{provider_payment_id}:bucket_5min`
- Check audit log: if provider_payment_id already processed → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- Razorpay retries webhook
- Idempotency key prevents duplicate processing

**ATOMIC GUARANTEES**:
- [ATOMIC] Payment state → FAILED in single DB operation

---

## ARTIFACT OPERATIONS (NON-STATE TRANSITIONS)

These are read-heavy or deletion operations, not state transitions.

---

### OPERATION A: ARTIFACT CREATE

**SERVICE**: ArtifactCreateService

**CALL ORDER**:
1. Guard validates ownership (ContainerOwnerArtifactCreateGuard)
2. ContainerArtifactUploadService.uploadArtifacts() called
   - (Shares implementation with TRANSITION 10)

**See TRANSITION 10 for full execution model.**

---

### OPERATION B: ARTIFACT DELETE

**SERVICE**: ArtifactDeleteService

**CALL ORDER**:
1. Guard validates ownership (ContainerOwnerArtifactDeleteGuard)
2. ArtifactDeleteService.deleteArtifact() called
   - Depends on: StorageService, AuditService

**DEPENDENCIES**:
- **StorageService**: Delete file from Supabase Storage
- **AuditService**: Log deletion attempt and result
- **Database**: Transaction on artifacts table

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Verify artifact owner == auth.uid()
- Verify container state ∈ {EMPTY, ARTIFACT_PLACED} (not sealed or validated)
- Delete artifact record from DB
- Call StorageService.deleteFile() (async, non-blocking)
- Commit

**ASYNC STEPS**:
- [ ] StorageService.deleteFile() from Supabase
  - Async, fire-and-forget after DB deletion
  - Failure does not roll back DB deletion (orphaned file acceptable)
  - Cleanup job can find and delete orphaned files periodically

**IDEMPOTENCY**:
- Key: `owner_id:artifact_deleted:{artifact_id}:bucket_5min`
- Check audit log: if artifact_id already deleted within 5 min → return 200 OK (no-op)

**RETRY BEHAVIOR**:
- User can retry after 15 seconds if network timeout
- Artifact already deleted → return 404 Not Found or 200 OK depending on retry

**ATOMIC GUARANTEES**:
- [ATOMIC] Artifact record deleted from DB (Supabase deletion is async/optional)

---

### OPERATION C: ARTIFACT VIEW

**SERVICE**: ArtifactViewService

**CALL ORDER**:
1. Guard validates access (ArtifactAccessGuard)
2. ArtifactViewService.viewArtifact() called
   - Depends on: StorageService, AuditService

**DEPENDENCIES**:
- **StorageService**: Generate signed URL (time-limited, 24 hours)
- **AuditService**: Log view attempt and result
- **Database**: Transaction on audit_logs table only (read-only to artifacts)

**TRANSACTION BOUNDARY**: Single transaction [ATOMIC]
- Insert audit log: action='artifact.viewed', actor_id, artifact_id, container_id, room_id
- Commit

**ASYNC STEPS**:
- None (URL generation is synchronous)

**IDEMPOTENCY**:
- No idempotency key (every view is a new audit entry, allowed)
- Each view logged separately

**RETRY BEHAVIOR**:
- User can retry after 10 seconds if network timeout
- Each retry creates new audit entry (expected behavior)

**ATOMIC GUARANTEES**:
- [ATOMIC] Audit log entry created for every view (no duplicate suppression)

---

## SYSTEM JOBS (NON-USER-INITIATED)

System jobs execute on fixed schedules and NEVER share code paths with user-initiated flows.

---

### JOB 1: Room Expiration Check

**SCHEDULED**: Every 5 minutes

**SERVICE**: RoomExpiryService

**EXECUTION**:
1. Query: SELECT room_id FROM rooms WHERE state='INVITE_SENT' AND expires_at <= NOW()
2. For each room: call RoomExpiryService.expireRoom() (see TRANSITION 9)
3. Idempotency: each room processed max once per 5 min window

**ISOLATION**: Separate database connection, no user request context

---

### JOB 2: Locked Room Progress Check

**SCHEDULED**: Every 1 minute

**SERVICE**: RoomProgressService

**EXECUTION**:
1. Query: SELECT room_id FROM rooms WHERE state='LOCKED' AND all_payments_confirmed AND NOW() > (created_at + 5 minutes)
2. For each room: call RoomProgressService.moveToProgress() (see TRANSITION 4)
3. Idempotency: each room processed max once per 5 min window

**ISOLATION**: Separate database connection

---

### JOB 3: Swap Execution Retry

**SCHEDULED**: Every 2 minutes

**SERVICE**: AtomicSwapExecutionService

**EXECUTION**:
1. Query: SELECT room_id FROM rooms WHERE state='SWAP_READY' AND created_at < NOW() - interval '5 minutes'
2. For each room: call AtomicSwapExecutionService.executeSwap() (see TRANSITION 7)
3. Idempotency: each room processed max once per 5 min window
4. Max 3 retry attempts per room; after 3 failures, alert Admin

**ISOLATION**: Separate database connection, direct service calls (no user request context)

---

### JOB 4: Virus Scan Status Check

**SCHEDULED**: Every 10 minutes

**SERVICE**: VirusScanService

**EXECUTION**:
1. Query: SELECT artifact_id FROM artifacts WHERE is_scanned=FALSE AND created_at < NOW() - interval '5 minutes'
2. For each artifact: call VirusScanService.checkScanStatus()
3. If scan result available: update artifact, notify user if infected
4. If scan timeout (> 24 hours): mark artifact as is_scanned=TRUE (best-effort), notify user

**ISOLATION**: Separate database connection

---

## WEBHOOK FLOWS (EXTERNAL SYSTEM CALLBACKS)

Webhooks are events from external systems (Razorpay, VirusTotal). They follow distinct code paths from user-initiated flows.

---

### WEBHOOK 1: Razorpay Payment Confirmation

**SOURCE**: Razorpay

**SIGNATURE VERIFICATION**: RazorpayWebhookGuard (verifies X-Razorpay-Signature header)

**SERVICE**: PaymentConfirmationService (see TRANSITION 16)

**ISOLATION**: 
- Separate transaction per webhook
- No user request context
- Idempotent processing (provider_payment_id is unique key)

---

### WEBHOOK 2: Razorpay Payment Failure

**SOURCE**: Razorpay

**SIGNATURE VERIFICATION**: RazorpayWebhookGuard

**SERVICE**: PaymentFailureService (see TRANSITION 17)

**ISOLATION**: 
- Separate transaction
- Idempotent processing

---

### WEBHOOK 3: Virus Scan Complete

**SOURCE**: VirusTotal or similar

**SIGNATURE VERIFICATION**: VirusScanWebhookGuard (verifies scan request ID)

**SERVICE**: VirusScanService.onScanComplete()

**EXECUTION**:
1. Verify webhook authenticity (scan request ID matches pending scan)
2. Update artifact: is_scanned=TRUE, is_infected=result
3. If infected: notify uploader async
4. Audit log: scan result

**ISOLATION**: 
- Separate transaction
- Idempotent (scan request ID prevents duplicates)

---

### WEBHOOK 4: AI Analysis Complete

**SOURCE**: AI Service (Gemini or similar)

**SIGNATURE VERIFICATION**: AIServiceWebhookGuard (verifies analysis request ID)

**SERVICE**: AIService.onAnalysisComplete()

**EXECUTION**:
1. Verify webhook authenticity (analysis request ID matches pending analysis)
2. Update container: validation_details=analysis_result
3. Audit log: AI analysis received
4. Do NOT trigger any state transition (read-only output)

**ISOLATION**: 
- Separate transaction
- Idempotent (analysis request ID prevents duplicates)

---

## TRANSACTIONAL BOUNDARIES SUMMARY

### Single Aggregate Root Per Transaction
- Room transitions do NOT mutate Containers in same transaction
- Container transitions do NOT mutate Rooms in same transaction
- Artifact operations do NOT mutate Room/Container state
- Payment updates do NOT mutate Room state

### Saga Pattern (Multi-Step Transitions)
- Room state change: TRANSACTION 1
- Container state change: TRANSACTION 2
- If either fails: audit logged, user notified, safe for retry

### Webhook Safety
- External confirmations (Razorpay, scans) execute in isolated transactions
- Webhook failure does not block user operations
- Webhook retry is safe (idempotent processing)

---

## FAILURE SCENARIOS & RECOVERY

### User-Initiated Flow Fails
- User can retry after backoff period (10-30 seconds depending on operation)
- Audit log shows retry attempt with same idempotency key
- No duplicate side effects (idempotency prevents)

### System Job Fails
- Retry on next scheduled execution (1-5 minutes later)
- After 3 failures, alert Admin
- Manual intervention may be required for critical operations (e.g., swap stuck)

### Webhook Fails
- External system (Razorpay, scan service) retries up to 5 times
- Backend idempotency prevents duplicate processing
- If webhook never arrives: user notified to check payment status

### Database Fails
- Transaction rolled back immediately
- User receives error response
- Audit log records failed attempt
- Retry safe (idempotency key)

### Storage Fails
- File upload/deletion async, non-blocking
- DB transaction commits first (artifact record created/deleted)
- Storage operation retried up to 3 times in background
- Orphaned files acceptable (cleanup job handles)

### Payment Fails
- Razorpay returns error to client
- Payment record remains PENDING
- User can retry locking room with same/new payment
- No funds debited until CONFIRMED status

### Swap Execution Fails
- Fails on PHASE 1 (precondition check): safe retry
- Fails on PHASE 2 (storage): room stays SWAP_READY, Admin alerted
- Fails on PHASE 3 (payment): room stays SWAP_READY, Admin alerted
- Fails on PHASE 4 (DB): incomplete swap, Admin intervention required

---

## AUDITABILITY GUARANTEES

### Audit Log Properties
- **Append-Only**: APPEND-ONLY enforced at database level (triggers prevent deletion)
- **Chronological**: `performed_at` timestamp immutable
- **Complete**: Every permission check, transition attempt, and result logged
- **Non-Repudiation**: actor_id + action immutable in audit trail

### Audit Log Entries
- Guard attempt: before execution, permission check logged
- Service execution: state change logged with previous/new state
- Side effects: each side effect logged separately (payment confirmed, artifact moved, etc.)
- Failures: failed attempts logged with reason

### Audit Log Retrieval
- Immutable PDF report generated on swap (includes all audit entries)
- Admin can query audit logs for investigation
- No modification possible (database-level enforcement)

---

## IDEMPOTENCY KEY STRATEGY

### Format
`{actor_id_or_system}:{action_type}:{aggregate_id}:bucket_{timestamp_bucket}`

Example:
- `user123:room_created_invite:bucket_5min`
- `admin456:container_approved:container_id_xyz:bucket_5min`
- `system:swap_executed:room_id_abc:bucket_5min`

### Bucket Strategy
- 5 minute window for user-initiated operations (prevents rapid double-clicks)
- 5 minute window for system jobs (prevents duplicate job execution in same window)
- Idempotency key checked in audit log before service execution

### Duplicate Detection
1. Incoming request generates idempotency key
2. Service queries audit log: SELECT COUNT(*) WHERE idempotency_key=key AND performed_at > NOW() - interval '5 min'
3. If found: return cached response (200 OK or previous error)
4. If not found: proceed with execution, record audit entry with key

---

## RETRY STRATEGY BY OPERATION

| Operation | Max Attempts | Backoff | Idempotent |
|-----------|-------------|---------|-----------|
| User retry (network timeout) | Manual, 3x safe | 10-30s | Yes |
| System job (1min schedule) | ∞ (repeated job cycles) | 1 min | Yes |
| System job (stuck operation) | 3 attempts, then alert Admin | 2-5 min | Yes |
| Webhook retry (Razorpay) | 5x by Razorpay | Exponential | Yes |
| Webhook retry (Virus Scan) | 5x by scan service | Exponential | Yes |
| Async notification | 3x exponential backoff | 5s, 25s, 125s | No (acceptable duplicate) |
| Payment capture (client) | Max 1 per 10 sec (rate limited) | N/A | Yes (idempotent order ID) |

---

## END OF EXECUTION MODEL

This document specifies the ONLY valid execution paths for NestJS backend services.
No deviation from these transaction boundaries, idempotency rules, or failure handling is permitted.
All services must implement these contracts exactly as specified.
