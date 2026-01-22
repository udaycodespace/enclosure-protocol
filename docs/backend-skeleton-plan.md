# ENCLOSURE BACKEND SKELETON PLAN
## NestJS File Structure & Dependency Injection Map

This document specifies every file to create, what it exports, and what it injects.
Names and dependencies map directly to UDAY.txt, UDAY-V1.txt, backend-execution-model.md, and backend-module-structure.md.

---

## INFRASTRUCTURE MODULES

---

## 1. AUDIT MODULE

**Module**: `src/audit/audit.module.ts`
- Exports: `AuditModule`, `AuditService`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `audit.module.ts` | `AuditModule` | — | Module |
| `audit.service.ts` | `AuditService` | — | Service |

---

## 2. NOTIFICATION MODULE

**Module**: `src/notification/notification.module.ts`
- Exports: `NotificationModule`, `NotificationService`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `notification.module.ts` | `NotificationModule` | — | Module |
| `notification.service.ts` | `NotificationService` | — | Service |

---

## 3. STORAGE MODULE

**Module**: `src/storage/storage.module.ts`
- Exports: `StorageModule`, `StorageService`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `storage.module.ts` | `StorageModule` | — | Module |
| `storage.service.ts` | `StorageService` | — | Service |

---

## 4. PAYMENT PROVIDER MODULE

**Module**: `src/payment-provider/payment-provider.module.ts`
- Exports: `PaymentProviderModule`, `RazorpayService`, `RazorpayWebhookGuard`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `payment-provider.module.ts` | `PaymentProviderModule` | — | Module |
| `razorpay.service.ts` | `RazorpayService` | — | Service |
| `razorpay-webhook.guard.ts` | `RazorpayWebhookGuard` | `RazorpayService` | Guard |

---

## 5. AI MODULE

**Module**: `src/ai/ai.module.ts`
- Exports: `AIModule`, `AIService`, `AIServiceWebhookGuard`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `ai.module.ts` | `AIModule` | — | Module |
| `ai.service.ts` | `AIService` | — | Service |
| `ai-webhook.guard.ts` | `AIServiceWebhookGuard` | `AIService` | Guard |
| `ai-webhook.controller.ts` | `AIWebhookController` | `AIService` | Webhook |

---

## 6. VIRUS SCAN MODULE

**Module**: `src/virus-scan/virus-scan.module.ts`
- Exports: `VirusScanModule`, `VirusScanService`, `VirusScanWebhookGuard`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `virus-scan.module.ts` | `VirusScanModule` | — | Module |
| `virus-scan.service.ts` | `VirusScanService` | — | Service |
| `virus-scan-webhook.guard.ts` | `VirusScanWebhookGuard` | `VirusScanService` | Guard |
| `virus-scan-webhook.controller.ts` | `VirusScanWebhookController` | `VirusScanService` | Webhook |
| `jobs/virus-scan-status.job.ts` | `VirusScanStatusJob` | `VirusScanService` | Job |

---

## DOMAIN MODULES

---

## 7. PAYMENT MODULE

**Module**: `src/payment/payment.module.ts`
- Exports: `PaymentModule`, `PaymentService`, `PaymentConfirmationService`, `PaymentFailureService`

### Files

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `payment.module.ts` | `PaymentModule` | — | Module |
| `entities/payment.entity.ts` | `Payment` | — | Entity |
| `payment.service.ts` | `PaymentService` | `RazorpayService`, `AuditService` | Service |
| `payment-confirmation.service.ts` | `PaymentConfirmationService` | `AuditService`, `NotificationService`, `RoomProgressService` | Service |
| `payment-failure.service.ts` | `PaymentFailureService` | `AuditService`, `NotificationService` | Service |
| `guards/razorpay-webhook.guard.ts` | `RazorpayWebhookGuard` | `RazorpayService` | Guard |
| `webhooks/razorpay-payment-confirmed.webhook.ts` | `RazorpayPaymentConfirmedWebhook` | `PaymentConfirmationService`, `RazorpayWebhookGuard` | Webhook |
| `webhooks/razorpay-payment-failed.webhook.ts` | `RazorpayPaymentFailedWebhook` | `PaymentFailureService`, `RazorpayWebhookGuard` | Webhook |

**Dependencies**: PaymentProviderModule, AuditModule, NotificationModule, RoomModule

---

## 8. ROOM MODULE

**Module**: `src/room/room.module.ts`
- Exports: `RoomModule`, and all 9 services/guards

### Files

#### Services

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `room.module.ts` | `RoomModule` | — | Module |
| `entities/room.entity.ts` | `Room` | — | Entity |
| `services/room-invite.service.ts` | `RoomInviteService` | `AuditService`, `NotificationService` | Service |
| `services/room-join.service.ts` | `RoomJoinService` | `AuditService`, `NotificationService`, `ContainerService` | Service |
| `services/room-lock.service.ts` | `RoomLockService` | `PaymentService`, `AuditService`, `NotificationService` | Service |
| `services/room-progress.service.ts` | `RoomProgressService` | `AuditService`, `NotificationService`, `ContainerService` | Service |
| `services/room-validation-start.service.ts` | `RoomValidationStartService` | `AuditService`, `AIService`, `ContainerService`, `NotificationService` | Service |
| `services/room-swap-approval.service.ts` | `RoomSwapApprovalService` | `AuditService`, `ContainerService` | Service |
| `services/atomic-swap-execution.service.ts` | `AtomicSwapExecutionService` | `StorageService`, `PaymentService`, `AuditService`, `NotificationService` | Service |
| `services/room-failure.service.ts` | `RoomFailureService` | `AuditService`, `NotificationService`, `ContainerService` | Service |
| `services/room-expiry.service.ts` | `RoomExpiryService` | `AuditService`, `NotificationService` | Service |

#### Guards

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `guards/creator-room-invite.guard.ts` | `CreatorRoomInviteGuard` | `AuditService` | Guard |
| `guards/counterparty-room-join.guard.ts` | `CounterpartyRoomJoinGuard` | `AuditService` | Guard |
| `guards/participant-room-lock.guard.ts` | `ParticipantRoomLockGuard` | `AuditService` | Guard |
| `guards/system-room-progress.guard.ts` | `SystemRoomProgressGuard` | `AuditService` | Guard |
| `guards/participant-room-validation-start.guard.ts` | `ParticipantRoomValidationStartGuard` | `AuditService` | Guard |
| `guards/admin-room-swap-approval.guard.ts` | `AdminRoomSwapApprovalGuard` | `AuditService` | Guard |
| `guards/system-atomic-swap.guard.ts` | `SystemAtomicSwapGuard` | `AuditService` | Guard |
| `guards/room-failure.guard.ts` | `RoomFailureGuard` | `AuditService` | Guard |
| `guards/system-room-expiry.guard.ts` | `SystemRoomExpiryGuard` | `AuditService` | Guard |

#### Jobs

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `jobs/room-expiry.job.ts` | `RoomExpiryJob` | `RoomExpiryService` | Job |
| `jobs/room-progress.job.ts` | `RoomProgressJob` | `RoomProgressService` | Job |
| `jobs/swap-execution.job.ts` | `SwapExecutionJob` | `AtomicSwapExecutionService` | Job |

#### Controller

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `room.controller.ts` | `RoomController` | All 9 services, all 9 guards | Controller |

**Dependencies**: PaymentModule, AuditModule, NotificationModule, AIModule, ContainerModule, StorageModule

---

## 9. CONTAINER MODULE

**Module**: `src/container/container.module.ts`
- Exports: `ContainerModule`, and all 6 services/guards

### Files

#### Services

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `container.module.ts` | `ContainerModule` | — | Module |
| `entities/container.entity.ts` | `Container` | — | Entity |
| `services/container-artifact-upload.service.ts` | `ContainerArtifactUploadService` | `StorageService`, `VirusScanService`, `AuditService` | Service |
| `services/container-seal.service.ts` | `ContainerSealService` | `AuditService`, `NotificationService` | Service |
| `services/container-validation-start.service.ts` | `ContainerValidationStartService` | `AuditService` | Service |
| `services/container-approve.service.ts` | `ContainerApproveService` | `AuditService` | Service |
| `services/container-reject.service.ts` | `ContainerRejectService` | `AuditService`, `RoomFailureService` | Service |
| `services/container-transfer.service.ts` | `ContainerTransferService` | `AuditService` | Service |

#### Guards

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `guards/container-owner-artifact-upload.guard.ts` | `ContainerOwnerArtifactUploadGuard` | `AuditService` | Guard |
| `guards/container-owner-seal.guard.ts` | `ContainerOwnerSealGuard` | `AuditService` | Guard |
| `guards/system-container-validation-start.guard.ts` | `SystemContainerValidationStartGuard` | `AuditService` | Guard |
| `guards/admin-container-approve.guard.ts` | `AdminContainerApproveGuard` | `AuditService` | Guard |
| `guards/admin-container-reject.guard.ts` | `AdminContainerRejectGuard` | `AuditService` | Guard |
| `guards/system-container-transfer.guard.ts` | `SystemContainerTransferGuard` | `AuditService` | Guard |

#### Controller

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `container.controller.ts` | `ContainerController` | All 6 services, all 6 guards | Controller |

**Dependencies**: AuditModule, StorageModule, VirusScanModule, RoomModule

---

## 10. ARTIFACT MODULE

**Module**: `src/artifact/artifact.module.ts`
- Exports: `ArtifactModule`, and all 3 services/guards

### Files

#### Services

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `artifact.module.ts` | `ArtifactModule` | — | Module |
| `entities/artifact.entity.ts` | `Artifact` | — | Entity |
| `services/artifact-create.service.ts` | `ArtifactCreateService` | `StorageService`, `AuditService`, `ContainerService` | Service |
| `services/artifact-delete.service.ts` | `ArtifactDeleteService` | `StorageService`, `AuditService`, `ContainerService` | Service |
| `services/artifact-view.service.ts` | `ArtifactViewService` | `StorageService`, `AuditService`, `ContainerService` | Service |

#### Guards

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `guards/container-owner-artifact-create.guard.ts` | `ContainerOwnerArtifactCreateGuard` | `AuditService` | Guard |
| `guards/container-owner-artifact-delete.guard.ts` | `ContainerOwnerArtifactDeleteGuard` | `AuditService` | Guard |
| `guards/artifact-access.guard.ts` | `ArtifactAccessGuard` | `AuditService` | Guard |

#### Controller

| File | Exports | Injects | Type |
|------|---------|---------|------|
| `artifact.controller.ts` | `ArtifactController` | All 3 services, all 3 guards | Controller |

**Dependencies**: StorageModule, AuditModule, ContainerModule

---

## DEPENDENCY GRAPH (Acyclic Verification)

```
Infrastructure (No Domain Dependencies):
├── AuditModule
├── NotificationModule
├── StorageModule
├── PaymentProviderModule
├── AIModule
└── VirusScanModule

Domain (Single-Direction Flow to Infrastructure):
├── PaymentModule
│   ├─→ PaymentProviderModule
│   ├─→ AuditModule
│   ├─→ NotificationModule
│   └─→ RoomModule (saga coordination only)
│
├── RoomModule
│   ├─→ PaymentModule
│   ├─→ AuditModule
│   ├─→ NotificationModule
│   ├─→ AIModule
│   ├─→ ContainerModule
│   └─→ StorageModule
│
├── ContainerModule
│   ├─→ AuditModule
│   ├─→ StorageModule
│   ├─→ VirusScanModule
│   └─→ RoomModule (read-only state checks)
│
└── ArtifactModule
    ├─→ StorageModule
    ├─→ AuditModule
    └─→ ContainerModule
```

**Cycle Detection**:
- PaymentModule → RoomModule → PaymentModule (saga coordination via RoomProgressService triggering)
  - Resolved via NestJS forwardRef in payment.module.ts imports RoomModule
- RoomModule → ContainerModule → RoomModule (container operations update room state)
  - Resolved via NestJS forwardRef in container.module.ts imports RoomModule

---

## FILE GENERATION COMMANDS (NestJS CLI)

### Infrastructure

```bash
nest g module audit
nest g service audit

nest g module notification
nest g service notification

nest g module storage
nest g service storage

nest g module payment-provider
nest g service payment-provider/razorpay
nest g guard payment-provider/razorpay-webhook

nest g module ai
nest g service ai/ai
nest g guard ai/ai-webhook
nest g controller ai/ai-webhook

nest g module virus-scan
nest g service virus-scan/virus-scan
nest g guard virus-scan/virus-scan-webhook
nest g controller virus-scan/virus-scan-webhook
```

### Domain

```bash
nest g module payment
nest g service payment/payment
nest g service payment/payment-confirmation
nest g service payment/payment-failure
nest g guard payment/razorpay-webhook
nest g controller payment/razorpay-payment-confirmed-webhook
nest g controller payment/razorpay-payment-failed-webhook

nest g module room
nest g service room/room-invite
nest g service room/room-join
nest g service room/room-lock
nest g service room/room-progress
nest g service room/room-validation-start
nest g service room/room-swap-approval
nest g service room/atomic-swap-execution
nest g service room/room-failure
nest g service room/room-expiry
nest g guard room/creator-room-invite
nest g guard room/counterparty-room-join
nest g guard room/participant-room-lock
nest g guard room/system-room-progress
nest g guard room/participant-room-validation-start
nest g guard room/admin-room-swap-approval
nest g guard room/system-atomic-swap
nest g guard room/room-failure
nest g guard room/system-room-expiry
nest g controller room/room

nest g module container
nest g service container/container-artifact-upload
nest g service container/container-seal
nest g service container/container-validation-start
nest g service container/container-approve
nest g service container/container-reject
nest g service container/container-transfer
nest g guard container/container-owner-artifact-upload
nest g guard container/container-owner-seal
nest g guard container/system-container-validation-start
nest g guard container/admin-container-approve
nest g guard container/admin-container-reject
nest g guard container/system-container-transfer
nest g controller container/container

nest g module artifact
nest g service artifact/artifact-create
nest g service artifact/artifact-delete
nest g service artifact/artifact-view
nest g guard artifact/container-owner-artifact-create
nest g guard artifact/container-owner-artifact-delete
nest g guard artifact/artifact-access
nest g controller artifact/artifact
```

---

## IMPORT PATHS (No Circular at File Level)

### Payment Module Imports

```typescript
// payment.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomModule } from '../room/room.module'; // forwardRef

// payment-confirmation.service.ts
import { RoomProgressService } from '../room/services/room-progress.service'; // via dependency injection, not direct import
```

### Room Module Imports

```typescript
// room.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { AIModule } from '../ai/ai.module';
import { ContainerModule } from '../container/container.module'; // forwardRef
import { StorageModule } from '../storage/storage.module';
```

### Container Module Imports

```typescript
// container.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { VirusScanModule } from '../virus-scan/virus-scan.module';
import { RoomModule } from '../room/room.module'; // forwardRef
```

---

## TOTAL FILE COUNT

| Module | Services | Guards | Jobs | Webhooks | Controllers | Entities | Module File | Total |
|--------|----------|--------|------|----------|-------------|----------|------------|-------|
| Audit | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| Notification | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| Storage | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| PaymentProvider | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 3 |
| AI | 1 | 1 | 0 | 1 | 0 | 0 | 1 | 4 |
| VirusScan | 1 | 1 | 1 | 1 | 0 | 0 | 1 | 5 |
| Payment | 3 | 1 | 0 | 2 | 0 | 1 | 1 | 8 |
| Room | 9 | 9 | 3 | 0 | 1 | 1 | 1 | 24 |
| Container | 6 | 6 | 0 | 0 | 1 | 1 | 1 | 15 |
| Artifact | 3 | 3 | 0 | 0 | 1 | 1 | 1 | 9 |
| **TOTAL** | **27** | **22** | **4** | **4** | **3** | **4** | **10** | **74** |

---

## NAMING CONVENTIONS (Applied to All Files)

- **Services**: `*.service.ts` (class name: PascalCase + "Service")
- **Guards**: `*.guard.ts` (class name: PascalCase + "Guard")
- **Controllers**: `*.controller.ts` (class name: PascalCase + "Controller")
- **Jobs**: `*.job.ts` (class name: PascalCase + "Job")
- **Webhooks**: `*.webhook.ts` (class name: PascalCase + "Webhook")
- **Entities**: `*.entity.ts` (class name: PascalCase)
- **Modules**: `*.module.ts` (class name: PascalCase + "Module")

---

## IMPLEMENTATION CHECKLIST

Use this checklist to verify all files are created and dependencies are correctly injected:

- [ ] Infrastructure: All 6 modules created
- [ ] Domain: All 4 modules created
- [ ] Services: 27 total services exported and injected correctly
- [ ] Guards: 22 total guards exported and injected correctly
- [ ] Jobs: 4 total jobs exported and injected correctly
- [ ] Webhooks: 4 total webhooks exported and injected correctly
- [ ] Controllers: 3 total controllers created
- [ ] Entities: 4 total entities created
- [ ] Module imports: All dependencies declared
- [ ] No circular imports at file level
- [ ] All names match UDAY-V1.txt exactly
- [ ] All service names match backend-execution-model.md exactly
- [ ] All guard names match backend-module-structure.md exactly

---

## END OF SKELETON PLAN

This plan is ready for file-by-file implementation using `nest g` commands.
No ambiguity exists in file structure, naming, or dependencies.
All contracts from authoritative source documents are preserved.
