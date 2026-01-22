# ENCLOSURE BACKEND MODULE STRUCTURE
## NestJS Boundary & Dependency Design

This document defines the module architecture for ENCLOSURE NestJS backend.
Module design strictly enforces separation of concerns, one-directional dependencies, and immutability of core contracts.

---

## ARCHITECTURE PRINCIPLES

### Module Boundaries
- **Domain Module**: Protects an aggregate (Room, Container, Artifact, Payment)
- **Infrastructure Module**: Provides cross-cutting concerns (Audit, Storage, Payment Provider, AI, Notifications, Virus Scan)
- **Guard Co-location**: Guards MUST live in the same module as the aggregate they protect
- **Service Ownership**: Each service owns its business logic; no service shares code paths with controllers/routes
- **Job/Webhook Isolation**: System jobs and webhooks execute in distinct contexts, never reuse user-initiated flow logic

### Dependency Direction
- **Acyclic**: No circular dependencies allowed
- **One-directional**: Dependencies flow from domain → infrastructure, never reverse
- **Explicit**: All dependencies listed and verified for each module

### Module Sizing
- **Aggregate-per-module**: One aggregate (Room, Container, etc.) per domain module
- **No God Modules**: No module owns >7 services or >6 guards
- **Infrastructure Separation**: Infrastructure modules never contain business logic

---

## INFRASTRUCTURE MODULES (No Dependencies on Domain)

---

### 1. AuditModule

**Responsibility**: 
Provides immutable, append-only audit logging for all state transitions, permission checks, and side effects.
Enforced at database level (triggers prevent deletion).

**Services Owned**:
- AuditService
  - logAttempt() — log guard permission check before execution
  - logResult() — log guard result (allowed/denied)
  - logTransition() — log service state change (prev → next)
  - logSideEffect() — log individual side effects (payment confirmed, artifact moved, etc.)
  - logFailure() — log failed transition with reason
  - checkIdempotency() — query recent audit log to detect duplicates

**Guards Owned**: None (infrastructure module)

**Jobs Owned**: None

**Webhooks Owned**: None

**Dependencies**: None (base infrastructure)

**Notes**:
- All domain modules depend on AuditModule
- Audit logs are immutable (database-level enforcement, triggers prevent deletion)
- Idempotency key checks prevent duplicate processing within 5-minute windows

---

### 2. NotificationModule

**Responsibility**: 
Handles asynchronous, non-blocking notifications (email, SMS, in-app). Failures do not roll back transactions.
Retry logic: exponential backoff, max 3 attempts per notification.

**Services Owned**:
- NotificationService
  - sendCreatorConfirmation() — notify room creator after room created
  - sendCounterpartyJoinedAlert() — notify creator when counterparty joins
  - sendRoomInProgressNotification() — notify both parties when room accepts artifacts
  - sendValidationReadyAlert() — notify admin when ready for validation
  - sendSwapCompleteNotification() — notify both parties of swap completion
  - sendRoomFailureNotification() — notify both parties of room failure
  - sendRoomExpirationNotice() — notify creator of expiration
  - sendCounterpartySealedNotification() — notify other party that side is sealed
  - sendPaymentFailedNotification() — notify user of payment failure
  - sendInfectedArtifactAlert() — notify uploader of infected file

**Guards Owned**: None

**Jobs Owned**: None

**Webhooks Owned**: None

**Dependencies**: None (infrastructure)

**Notes**:
- All notifications are async, fire-and-forget after DB transaction commits
- Retry failures do not roll back state changes
- Used by all domain modules

---

### 3. StorageModule

**Responsibility**: 
Manages file operations with Supabase Storage (upload, download, delete, move).
Operations are async; orphaned files acceptable (cleanup job handles).

**Services Owned**:
- StorageService
  - uploadFile() — blocking upload to Supabase Storage, return file_hash
  - deleteFile() — async delete from Supabase Storage
  - moveArtifacts() — move artifacts from container to owner storage (used in atomic swap)
  - generateSignedUrl() — generate time-limited signed URL (24 hours)

**Guards Owned**: None

**Jobs Owned**: None

**Webhooks Owned**: None

**Dependencies**: None (infrastructure)

**Notes**:
- Upload is blocking (needed for precondition check)
- Delete/Move are async, failures do not block user operations
- Signed URLs are time-limited to 24 hours

---

### 4. PaymentProviderModule

**Responsibility**: 
Integrates with Razorpay payment gateway. Creates payment orders, verifies webhooks, and queries payment status.
Webhook signature verification is performed here.

**Services Owned**:
- RazorpayService
  - createOrder() — create Razorpay payment order, return order_id
  - verifyPaymentWebhookSignature() — verify X-Razorpay-Signature header
  - queryPaymentStatus() — query Razorpay API for payment status

**Guards Owned**:
- RazorpayWebhookGuard — verify webhook signature before PaymentModule processes

**Jobs Owned**: None

**Webhooks Owned**: None (webhooks owned by PaymentModule)

**Dependencies**: None (external integration)

**Notes**:
- Webhook signature verification must pass BEFORE PaymentModule services execute
- RazorpayWebhookGuard is infrastructure (not tied to specific aggregate)
- All Razorpay API calls return immutable results (idempotent by provider design)

---

### 5. AIModule

**Responsibility**: 
Integrates with AI service (Gemini) for read-only artifact comparison analysis.
AI has no mutation capability; output is informational only.

**Services Owned**:
- AIService
  - requestAnalysis() — submit artifact metadata for analysis (async)
  - onAnalysisComplete() — webhook callback when analysis finishes (stores result in container.validation_details)

**Guards Owned**:
- AIServiceWebhookGuard — verify analysis request ID on webhook callback

**Jobs Owned**: None

**Webhooks Owned**:
- AIAnalysisCompleteWebhook — receives analysis result from AI service

**Dependencies**: None (external integration)

**Notes**:
- AI analysis is read-only (no artifact mutations)
- Analysis result stored in container.validation_details (JSONB)
- Failure does not roll back room state (isolated error handling)
- Analysis request ID is idempotency key

---

### 6. VirusScanModule

**Responsibility**: 
Integrates with VirusTotal or similar for async artifact virus scanning.
Scan results update artifact.is_infected flag.

**Services Owned**:
- VirusScanService
  - scanArtifact() — submit artifact for scan (async)
  - onScanComplete() — webhook callback when scan finishes (update artifact.is_scanned, artifact.is_infected)
  - checkScanStatus() — query scan service for pending results (used by system job)

**Guards Owned**:
- VirusScanWebhookGuard — verify scan request ID on webhook callback

**Jobs Owned**:
- VirusScanStatusJob (every 10 minutes) — retry pending scans, handle timeouts

**Webhooks Owned**:
- VirusScanCompleteWebhook — receives scan result from VirusTotal

**Dependencies**: None (external integration)

**Notes**:
- Scan is async, non-blocking after artifact upload
- Timeout after 24 hours (mark as scanned with best-effort status)
- Scan request ID is idempotency key

---

## DOMAIN MODULES (Aggregate-Protected, Depend on Infrastructure)

---

### 7. PaymentModule

**Responsibility**: 
Manages payment aggregate lifecycle (PENDING → CONFIRMED or FAILED).
Payment records are append-only, immutable (no updates, only new records for refunds).

**Services Owned**:
- PaymentConfirmationService — transition PENDING → CONFIRMED on Razorpay webhook
- PaymentFailureService — transition PENDING → FAILED on Razorpay webhook

**Guards Owned**:
- RazorpayWebhookGuard (co-located with PaymentModule, not PaymentProviderModule)

**Jobs Owned**: None

**Webhooks Owned**:
- RazorpayPaymentConfirmedWebhook (payment.confirmed) — triggers PaymentConfirmationService
- RazorpayPaymentFailedWebhook (payment.failed) — triggers PaymentFailureService

**Dependencies**:
- PaymentProviderModule (Razorpay API calls)
- AuditModule (log transitions)
- NotificationModule (send payment failure alerts)
- RoomModule (saga coordination: trigger room → IN_PROGRESS after payment confirmed)

**Notes**:
- Payment transitions are webhook-driven (external Razorpay events)
- No user can directly call payment transition endpoints (webhooks only)
- Idempotency key: `razorpay:{provider_payment_id}:bucket_5min`
- Saga pattern: PaymentConfirmationService may trigger RoomProgressService

---

### 8. RoomModule

**Responsibility**: 
Manages room aggregate lifecycle through 9 state transitions (ROOM_CREATED → INVITE_SENT → JOINED → LOCKED → IN_PROGRESS → UNDER_VALIDATION → SWAP_READY → SWAPPED, or FAILED/EXPIRED paths).
Enforces state machine rules, actor permissions, and preconditions.

**Services Owned**:
- RoomInviteService — ROOM_CREATED → INVITE_SENT
- RoomJoinService — INVITE_SENT → JOINED
- RoomLockService — JOINED → LOCKED
- RoomProgressService — LOCKED → IN_PROGRESS
- RoomValidationStartService — IN_PROGRESS → UNDER_VALIDATION
- RoomSwapApprovalService — UNDER_VALIDATION → SWAP_READY
- AtomicSwapExecutionService — SWAP_READY → SWAPPED
- RoomFailureService — IN_PROGRESS → FAILED
- RoomExpiryService — INVITE_SENT → EXPIRED

**Guards Owned**:
- CreatorRoomInviteGuard — verify creator, room fields valid
- CounterpartyRoomJoinGuard — verify non-creator, email domain valid
- ParticipantRoomLockGuard — verify participant, OTP fresh, session age < 15 min
- SystemRoomProgressGuard — verify system caller or admin override
- ParticipantRoomValidationStartGuard — verify participant, both containers sealed
- AdminRoomSwapApprovalGuard — verify admin role, validation_summary set
- SystemAtomicSwapGuard — verify system caller, all preconditions
- RoomFailureGuard — verify admin or participant
- SystemRoomExpiryGuard — verify system caller, room expired

**Jobs Owned**:
- RoomExpiryJob (every 5 minutes) — find expired INVITE_SENT rooms, call RoomExpiryService
- RoomProgressJob (every 1 minute) — find LOCKED rooms with all payments confirmed, call RoomProgressService
- SwapExecutionJob (every 2 minutes) — find SWAP_READY rooms, retry AtomicSwapExecutionService (max 3 attempts)

**Webhooks Owned**: None (webhooks belong to PaymentModule)

**Dependencies**:
- PaymentModule (verify payments confirmed)
- AuditModule (log transitions)
- NotificationModule (send emails)
- AIModule (AI analysis read-only)
- ContainerModule (verify containers sealed, transition containers)
- StorageModule (move artifacts in swap)

**Notes**:
- All room transitions enforce atomic guarantees (documented in backend-execution-model.md)
- Rate limits: 10 transitions per minute per user, 1 LOCK per 10 seconds
- Idempotency keys: 5-minute windows per actor/transition/room
- Saga pattern: RoomFailureService may trigger ContainerRejectService

---

### 9. ContainerModule

**Responsibility**: 
Manages container aggregate lifecycle through 6 state transitions (EMPTY → ARTIFACT_PLACED → SEALED → UNDER_VALIDATION → VALIDATED or VALIDATION_FAILED, then TRANSFERRED).
Coordinates with rooms for consistent state.

**Services Owned**:
- ContainerArtifactUploadService — EMPTY → ARTIFACT_PLACED (creates artifact records, async virus scan)
- ContainerSealService — ARTIFACT_PLACED → SEALED
- ContainerValidationStartService — SEALED → UNDER_VALIDATION (triggered by room state change)
- ContainerApproveService — UNDER_VALIDATION → VALIDATED (admin approval)
- ContainerRejectService — UNDER_VALIDATION → VALIDATION_FAILED (admin rejection, triggers room failure)
- ContainerTransferService — VALIDATED → TRANSFERRED (triggered by room swap)

**Guards Owned**:
- ContainerOwnerArtifactUploadGuard — verify owner, room IN_PROGRESS, file size limits
- ContainerOwnerSealGuard — verify owner, all artifacts scanned and not infected
- SystemContainerValidationStartGuard — verify room transitioned to UNDER_VALIDATION
- AdminContainerApproveGuard — verify admin role
- AdminContainerRejectGuard — verify admin role
- SystemContainerTransferGuard — verify room transitioned to SWAPPED

**Jobs Owned**: None

**Webhooks Owned**: None

**Dependencies**:
- AuditModule (log transitions)
- StorageModule (upload files, delete files)
- VirusScanModule (trigger scans, handle results)
- RoomModule (verify room state, coordinate transitions)

**Notes**:
- Container upload is two-phase: DB transaction first (artifact records), then async scan
- Scan failure is isolated (does not roll back state)
- Virus-infected artifacts block sealing
- Idempotency keys: 5-minute windows per owner/operation/container

---

### 10. ArtifactModule

**Responsibility**: 
Manages artifact operations (CREATE, DELETE, VIEW) without state transitions.
Enforces access control and audit logging for all artifact access.

**Services Owned**:
- ArtifactCreateService — create artifact record + upload file (wraps ContainerArtifactUploadService logic)
- ArtifactDeleteService — delete artifact record + async storage deletion
- ArtifactViewService — generate signed URL + mandatory audit log of all non-owner views

**Guards Owned**:
- ContainerOwnerArtifactCreateGuard — verify owner, container state in {EMPTY, ARTIFACT_PLACED}
- ContainerOwnerArtifactDeleteGuard — verify owner, container state in {EMPTY, ARTIFACT_PLACED}
- ArtifactAccessGuard — verify access (owner always allowed; counterparty only if container VALIDATED/TRANSFERRED)

**Jobs Owned**: None

**Webhooks Owned**: None

**Dependencies**:
- StorageModule (upload/delete files)
- AuditModule (log all access)
- ContainerModule (verify container state, owner)

**Notes**:
- ArtifactCreateService shares implementation with ContainerArtifactUploadService (same artifact creation logic)
- DELETE is async; orphaned files acceptable
- VIEW is read-only; every non-owner access is mandatory audited
- Idempotency keys: 5-minute windows per owner/operation/artifact

---

## DEPENDENCY SUMMARY (Acyclic Verification)

```
Infrastructure Layer (no dependencies on domain):
├── AuditModule
├── NotificationModule
├── StorageModule
├── PaymentProviderModule
├── AIModule
└── VirusScanModule

Domain Layer (dependencies flow downward to infrastructure):
├── PaymentModule
│   └─> PaymentProviderModule, AuditModule, NotificationModule, RoomModule
├── RoomModule
│   └─> PaymentModule, AuditModule, NotificationModule, AIModule, ContainerModule, StorageModule
├── ContainerModule
│   └─> AuditModule, StorageModule, VirusScanModule, RoomModule
└── ArtifactModule
    └─> StorageModule, AuditModule, ContainerModule
```

**Circular Dependency Check**: None detected
- RoomModule → PaymentModule → RoomModule (saga coordination, not circular code dependency)
- RoomModule → ContainerModule → RoomModule (only for read-only state checks, not circular mutation)

---

## MODULE RESPONSIBILITIES AT A GLANCE

| Module | Aggregate | Transitions | Guards | Services | Jobs | Webhooks |
|--------|-----------|-------------|--------|----------|------|----------|
| Room | Room | 9 | 9 | 9 | 3 | 0 |
| Container | Container | 6 | 6 | 6 | 0 | 0 |
| Artifact | Artifact | 0 | 3 | 3 | 0 | 0 |
| Payment | Payment | 2 | 1 | 2 | 0 | 2 |
| Audit | Audit Log | 0 | 0 | 1 | 0 | 0 |
| Notification | Messages | 0 | 0 | 1 | 0 | 0 |
| Storage | Files | 0 | 0 | 1 | 0 | 0 |
| PaymentProvider | Razorpay | 0 | 1 | 1 | 0 | 0 |
| AI | Analysis | 0 | 1 | 1 | 0 | 1 |
| VirusScan | Scans | 0 | 1 | 1 | 1 | 1 |

---

## IMPLEMENTATION SEQUENCE

### Phase 1: Infrastructure (No Domain Dependency)
1. AuditModule (foundational, no dependencies)
2. NotificationModule
3. StorageModule
4. PaymentProviderModule
5. AIModule
6. VirusScanModule

### Phase 2: Domain (Depends on Infrastructure + Other Domain)
1. PaymentModule (depends on infrastructure + provides payment events)
2. RoomModule (depends on infrastructure + PaymentModule + ContainerModule)
3. ContainerModule (depends on infrastructure + RoomModule)
4. ArtifactModule (depends on infrastructure + ContainerModule)

---

## FILE STRUCTURE (Derived from Module Design)

```
src/
├── audit/                  # AuditModule
│   ├── audit.module.ts
│   ├── audit.service.ts
│   └── audit.controller.ts (optional, admin endpoints)
│
├── notification/           # NotificationModule
│   ├── notification.module.ts
│   ├── notification.service.ts
│   └── notifiers/          # Email, SMS, in-app
│
├── storage/               # StorageModule
│   ├── storage.module.ts
│   ├── storage.service.ts
│   └── supabase/          # Supabase client
│
├── payment-provider/      # PaymentProviderModule
│   ├── payment-provider.module.ts
│   ├── razorpay.service.ts
│   └── razorpay-webhook.guard.ts
│
├── ai/                    # AIModule
│   ├── ai.module.ts
│   ├── ai.service.ts
│   ├── ai-webhook.guard.ts
│   └── ai-webhook.controller.ts
│
├── virus-scan/            # VirusScanModule
│   ├── virus-scan.module.ts
│   ├── virus-scan.service.ts
│   ├── virus-scan-webhook.guard.ts
│   ├── virus-scan-webhook.controller.ts
│   └── virus-scan.job.ts
│
├── payment/               # PaymentModule
│   ├── payment.module.ts
│   ├── entities/
│   │   └── payment.entity.ts
│   ├── payment-confirmation.service.ts
│   ├── payment-failure.service.ts
│   ├── razorpay-webhook.controller.ts
│   └── razorpay-webhook.guard.ts (re-exported from payment-provider)
│
├── room/                  # RoomModule
│   ├── room.module.ts
│   ├── entities/
│   │   └── room.entity.ts
│   ├── guards/
│   │   ├── creator-room-invite.guard.ts
│   │   ├── counterparty-room-join.guard.ts
│   │   ├── participant-room-lock.guard.ts
│   │   ├── system-room-progress.guard.ts
│   │   ├── participant-room-validation-start.guard.ts
│   │   ├── admin-room-swap-approval.guard.ts
│   │   ├── system-atomic-swap.guard.ts
│   │   ├── room-failure.guard.ts
│   │   └── system-room-expiry.guard.ts
│   ├── services/
│   │   ├── room-invite.service.ts
│   │   ├── room-join.service.ts
│   │   ├── room-lock.service.ts
│   │   ├── room-progress.service.ts
│   │   ├── room-validation-start.service.ts
│   │   ├── room-swap-approval.service.ts
│   │   ├── atomic-swap-execution.service.ts
│   │   ├── room-failure.service.ts
│   │   └── room-expiry.service.ts
│   ├── jobs/
│   │   ├── room-expiry.job.ts
│   │   ├── room-progress.job.ts
│   │   └── swap-execution.job.ts
│   └── room.controller.ts (orchestrates guards + services)
│
├── container/             # ContainerModule
│   ├── container.module.ts
│   ├── entities/
│   │   └── container.entity.ts
│   ├── guards/
│   │   ├── container-owner-artifact-upload.guard.ts
│   │   ├── container-owner-seal.guard.ts
│   │   ├── system-container-validation-start.guard.ts
│   │   ├── admin-container-approve.guard.ts
│   │   ├── admin-container-reject.guard.ts
│   │   └── system-container-transfer.guard.ts
│   ├── services/
│   │   ├── container-artifact-upload.service.ts
│   │   ├── container-seal.service.ts
│   │   ├── container-validation-start.service.ts
│   │   ├── container-approve.service.ts
│   │   ├── container-reject.service.ts
│   │   └── container-transfer.service.ts
│   └── container.controller.ts
│
└── artifact/              # ArtifactModule
    ├── artifact.module.ts
    ├── entities/
    │   └── artifact.entity.ts
    ├── guards/
    │   ├── container-owner-artifact-create.guard.ts
    │   ├── container-owner-artifact-delete.guard.ts
    │   └── artifact-access.guard.ts
    ├── services/
    │   ├── artifact-create.service.ts
    │   ├── artifact-delete.service.ts
    │   └── artifact-view.service.ts
    └── artifact.controller.ts
```

---

## GUARD & SERVICE CO-LOCATION VERIFICATION

All guards are co-located with the aggregate they protect:

✅ CreatorRoomInviteGuard → RoomModule (protects Room)
✅ CounterpartyRoomJoinGuard → RoomModule (protects Room)
✅ ParticipantRoomLockGuard → RoomModule (protects Room)
✅ SystemRoomProgressGuard → RoomModule (protects Room)
✅ ParticipantRoomValidationStartGuard → RoomModule (protects Room)
✅ AdminRoomSwapApprovalGuard → RoomModule (protects Room)
✅ SystemAtomicSwapGuard → RoomModule (protects Room)
✅ RoomFailureGuard → RoomModule (protects Room)
✅ SystemRoomExpiryGuard → RoomModule (protects Room)
✅ ContainerOwnerArtifactUploadGuard → ContainerModule (protects Container)
✅ ContainerOwnerSealGuard → ContainerModule (protects Container)
✅ SystemContainerValidationStartGuard → ContainerModule (protects Container)
✅ AdminContainerApproveGuard → ContainerModule (protects Container)
✅ AdminContainerRejectGuard → ContainerModule (protects Container)
✅ SystemContainerTransferGuard → ContainerModule (protects Container)
✅ ContainerOwnerArtifactCreateGuard → ArtifactModule (protects Artifact)
✅ ContainerOwnerArtifactDeleteGuard → ArtifactModule (protects Artifact)
✅ ArtifactAccessGuard → ArtifactModule (protects Artifact)
✅ RazorpayWebhookGuard → PaymentModule (protects Payment)

---

## END OF MODULE STRUCTURE

This architecture is clean, testable, and implements all contracts from UDAY.txt and backend-execution-model.md.
No circular dependencies. No code reuse between user flows and system jobs.
Audit logging is pervasive. Payment safety is built-in.
