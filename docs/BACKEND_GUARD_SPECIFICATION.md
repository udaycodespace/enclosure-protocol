# ENCLOSURE — BACKEND STATE TRANSITION GUARD SPECIFICATION

**Authoritative Source Contract for NestJS Guards**

**Date:** January 22, 2026  
**Classification:** SECURITY-CRITICAL  
**Status:** DESIGN (Non-Negotiable)

> This document defines **the only allowed backend state transitions**, **the only allowed actors**, **the exact preconditions**, and **the exact failure modes**.
>
> This is the **vault door**. Every transition must pass through here.
> Every gate must lock behind it.

---

## GLOBAL ENFORCEMENT RULES (ABSOLUTE)

### 1. STATE MACHINE ABSOLUTISM
- Transitions MUST match [docs/state-machine.md](docs/state-machine.md) exactly
- No skipping states
- No backward transitions
- No silent retries or fallthrough
- No partial success (all-or-nothing)
- **Enforcement:** Guard fails with `409 CONFLICT` if preconditions fail

### 2. ROLE ISOLATION (Non-Negotiable)
- Client and Freelancer NEVER see each other's identity
- Admin visibility ≠ admin power (read-mostly)
- System_AI is READ-ONLY and SUGGEST-ONLY (cannot execute state changes)
- **Enforcement:** RLS + Guard double-check

### 3. SESSION SECURITY (Multi-Layer)
- All transitions require a valid session
- Sensitive transitions require **fresh session** (< 5 min old)
- OTP required for first signup, first login on new device, payments, room LOCK
- Session fixation and replay attacks must be impossible
- **Enforcement:** Guard validates JWT `exp`, `iat`, custom `fresh_login_at` claim

### 4. AUTHENTICATION RULES (Strict)
- Email-only authentication
- Allowed domains **ONLY:**
  - `gmail.com`
  - `yahoo.com`
- Temp mail (tempmail.com, 10minutemail.com, etc.) → HARD REJECT
- Unknown domains → HARD REJECT
- **Enforcement:** Email validation at signup guard (before profile creation)

### 5. INPUT VALIDATION (Zero Trust)
- All inputs validated server-side (no frontend trust)
- Zod-style strict schemas enforced
- Reject unknown fields
- Reject oversized payloads (max 1MB per artifact metadata)
- Reject mismatched room/container/artifact IDs
- **Enforcement:** Guard validates DTO before service layer

### 6. PAYMENT SAFETY (Immutable Financial Facts)
- No state change allowed before payment confirmation
- Payment webhooks verified and idempotent (replay-safe)
- Payment failure must NOT mutate any room/container state
- Refunds are NEW payment events, never UPDATE operations
- **Enforcement:** Payment status checked before state transitions; webhook idempotency key required

### 7. AI BOUNDARIES (Suggester, Not Executor)
- Gemini can:
  - Read artifacts
  - Generate validation suggestion/summary
  - Flag risks
- Gemini CANNOT:
  - Change room/container state
  - Release funds
  - Modify artifacts
  - Override auth rules
- **Enforcement:** System_AI user role has no permission to call state transition services

### 8. AUDIT IMMUTABILITY (Eternal Facts)
- Every transition produces an audit log entry
- Audit logs are APPEND-ONLY (database trigger enforces)
- No update, no delete, no modification
- Actor, timestamp, old state, new state all recorded
- **Enforcement:** Database trigger + guard writes log on every transition

---

## ROOM STATE TRANSITIONS

---

### TRANSITION 1: Create Room (ROOM_CREATED → INVITE_SENT)

**Service Name:** `RoomCreateService`

**ENTITY:**
- Room

**CURRENT STATE:**
- N/A (new room)

**ALLOWED NEXT STATE(S):**
- INVITE_SENT

**ACTOR ALLOWED:**
- ✅ Client (can create)
- ✅ Freelancer (can create)
- ❌ Admin (can create on behalf, with audit note)
- ❌ System_AI (cannot)

**NOTE:** Room creation automatically generates and sends invite. No separate invite transition exists; invite sending is implicit in RoomCreateService.

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated (JWT present, signature valid, not expired)
- User email domain is in `['gmail.com', 'yahoo.com']` (hard check)
- User has an active profile with `role IN ('CLIENT', 'FREELANCER')`
- User free tier: current room count < 3 (if not paid subscriber)
- `room.room_type` is set to `'MUTUAL_TRANSFER'` or `'ESCROW_VALIDATION'` (required)
- `room.title` is non-empty, length > 3, length < 256
- `room.amount_total` is non-negative number (for escrow mode)
- `room.currency` is in `['INR']` (for now)
- `room.expires_at` is future timestamp and < 90 days from now
- If `room_type == 'ESCROW_VALIDATION'`: counterparty email is provided and valid
- No SQL injection in string fields (sanitized)

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **NO** (first login handled separately)
- Session freshness required: **NO** (new room creation is not sensitive)
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room.title`: string, length 3-256, alphanumeric + spaces + punctuation, no Unicode extremes
- `room.requirements`: optional string, length 0-10000, sanitize HTML
- `room.room_type`: enum `['MUTUAL_TRANSFER', 'ESCROW_VALIDATION']`
- `room.amount_total`: decimal, range [0, 999999.99], always 2 decimal places
- `room.expires_at`: ISO 8601 timestamp, must be >= now + 1 hour, <= now + 90 days
- Unknown fields in request: REJECT (strict mode)

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`CREATE_ROOM`)
- Payment event triggered: **NO**
- Container sealed/unsealed: **NO** (containers created empty later)
- AI visibility change: **NO**
- New containers created: **YES** (two empty containers A and B)

**FAILURE HANDLING:**
- If user not authenticated: return `401 UNAUTHORIZED`
- If user email domain invalid: return `400 BAD_REQUEST` (with message "Email domain not allowed")
- If room count exceeded: return `403 FORBIDDEN` (with message "Free tier limit reached")
- If `room_type` missing: return `400 BAD_REQUEST`
- If `expires_at` is in past: return `400 BAD_REQUEST`
- If database error: return `500 INTERNAL_SERVER_ERROR`, do not mutate room state
- **Critical:** On any error, no room is created, no containers are created

**EDGE CASES (MANDATORY):**
- **Abuse:** Rapid room creation (spam) → Rate limit: max 5 rooms per hour per user, return `429 TOO_MANY_REQUESTS`
- **Abuse:** Bot trying to enumerate freelancer emails → No information leak in response; response is identical whether user exists or not
- **Abuse:** Creating room to extort counterparty → Cannot enforce at this level; handled via admin review after abuse report
- **Edge:** User has 2.99 free rooms (rounding) → Reject: count must be exact integer
- **Edge:** Timezone confusion on `expires_at` → Input must be UTC ISO 8601, guard does not interpret timezones
- **Edge:** Unicode in title (e.g., Emoji) → Allow, but sanitize HTML tags; UTF-8 stored, displayed correctly
- **Edge:** Two users create room simultaneously with same ID → Database UUID generation prevents collision; guard is stateless

---

### TRANSITION 2: Join Room (INVITE_SENT → JOINED)

**Service Name:** `RoomJoinService`

**ENTITY:**
- Room

**CURRENT STATE:**
- INVITE_SENT

**ALLOWED NEXT STATE(S):**
- JOINED

**ACTOR ALLOWED:**
- ✅ Invited counterparty (joins)
- ❌ Room creator (cannot re-join own room)
- ❌ Random user (cannot bypass invite)
- ❌ Admin (can override, with audit)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated (JWT valid)
- User email domain in `['gmail.com', 'yahoo.com']`
- Invite token is provided and valid (format: 32-byte hex string)
- Invite token has not expired (TTL: 7 days)
- Invite token has not been used (one-time or reusable? → **REUSABLE** to avoid race conditions)
- User email matches invite target (for ESCROW_VALIDATION) OR user role is acceptor (for MUTUAL_TRANSFER)
- Room state is exactly `INVITE_SENT`
- User is not the room creator
- User does not have pending dispute with creator (optional abuse check)

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **NO** (join is low-risk)
- Session freshness required: **NO**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `invite_token`: 32-byte hex string, no extra whitespace
- No other inputs required

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`JOINED`)
- Payment event triggered: **NO**
- Container assignment: YES (user assigned as owner of container B if creator is A, or vice versa)
- AI visibility change: **NO**
- Room metadata updated: `freelancer_id` or `client_id` set (depending on room_type)

**FAILURE HANDLING:**
- If invite token invalid or expired: return `410 GONE`
- If invite token does not exist: return `404 NOT_FOUND`
- If room state not INVITE_SENT: return `409 CONFLICT`
- If user is room creator: return `403 FORBIDDEN` (with message "Cannot join own room")
- If user email does not match target: return `403 FORBIDDEN`
- If user is different person trying to use another's credentials: return `401 UNAUTHORIZED`
- **Critical:** On error, room state remains INVITE_SENT

**EDGE CASES (MANDATORY):**
- **Abuse:** Token brute-force (try all 32-byte combinations) → Rate limit: max 10 join attempts per IP per hour
- **Abuse:** Two users trying to join same room with same token → Race condition: first wins, second gets `409` (room already joined)
- **Abuse:** User joins, then joins again with same token → Idempotent: second join is no-op, returns `200 OK`
- **Edge:** Invite expires mid-join → Reject with `410 GONE`
- **Edge:** Room creator deletes room before counterparty joins → Cascade delete on foreign key; second user gets `404`

---

### TRANSITION 3: Lock Room (JOINED → LOCKED)

**Service Name:** `RoomLockService`

**ENTITY:**
- Room

**CURRENT STATE:**
- JOINED

**ALLOWED NEXT STATE(S):**
- LOCKED

**ACTOR ALLOWED:**
- ✅ Client (can initiate lock if ready)
- ✅ Freelancer (can initiate lock if ready)
- ❌ Either party (but not both, system decides order)
- ❌ Admin (can force, with audit)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated (JWT valid)
- User is either `client_id` or `freelancer_id` in the room
- Room state is exactly `JOINED`
- Both client and freelancer are present in room (both have accepted invite, not just creator)
- For ESCROW_VALIDATION: client has confirmed requirements
- For MUTUAL_TRANSFER: both parties have confirmed mutual expectations
- Room has not exceeded inactivity timeout (48 hours from creation)
- No active disputes on this room (optional admin flag)

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **YES** (lock is sensitive; requires fresh OTP or fresh session < 5 min old)
- Session freshness required: **YES** (< 5 minutes)
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID, must match authenticated user's room
- OTP (if required): 6-digit numeric string, case-insensitive
- No other inputs

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`LOCK_INITIATED` by user; followed by `LOCK_CONFIRMED` if both sides lock)
- Payment event triggered: **YES** (placement fee 5% charged to both client and freelancer)
- Room state set to: `LOCKED`
- Containers unlocked for artifact placement: **YES**
- AI visibility change: **NO**
- Payment webhook: Razorpay order created (state: PENDING)

**FAILURE HANDLING:**
- If room not in JOINED: return `409 CONFLICT`
- If user not room participant: return `403 FORBIDDEN`
- If OTP invalid or expired: return `401 UNAUTHORIZED` (with message "Invalid or expired OTP")
- If session not fresh: return `401 UNAUTHORIZED` (with message "Session expired; re-login required")
- If payment initiation fails: return `402 PAYMENT_REQUIRED` (with retry guidance)
- If inactivity timeout exceeded: return `408 REQUEST_TIMEOUT`
- **Critical:** If payment fails, room state remains `JOINED`, no state change occurs

**EDGE CASES (MANDATORY):**
- **Abuse:** Lock-unlock cycle to drain OTP quota → Rate limit: max 3 lock attempts per hour per room
- **Abuse:** Locking then disappearing to freeze counterparty → Inactivity timeout (48 hrs from creation) auto-cancels room
- **Abuse:** OTP replay attack → OTP marked as used after first successful validation; second use rejected
- **Abuse:** User logs out then tries to lock with old session → JWT validation fails (exp claim checked)
- **Edge:** Payment processor down when locking → Return `503 SERVICE_UNAVAILABLE`; user can retry; no state mutation
- **Edge:** Both users lock simultaneously → Race condition: first lock wins, sets state to LOCKED; second lock gets `409`
- **Edge:** Freelancer joins mid-lock attempt → Guard re-checks room state; if not JOINED anymore, reject

---

### TRANSITION 4: Progress Room (LOCKED → IN_PROGRESS)

**Service Name:** `RoomProgressService`

**ENTITY:**
- Room

**CURRENT STATE:**
- LOCKED

**ALLOWED NEXT STATE(S):**
- IN_PROGRESS

**ACTOR ALLOWED:**
- ✅ Client or Freelancer (either can initiate)
- ✅ Admin (can force, with audit)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated (JWT valid)
- User is either `client_id` or `freelancer_id`
- Room state is exactly `LOCKED`
- Both placement fees confirmed as PENDING or later (payments exist)
- Room has not exceeded inactivity timeout (96 hours from lock)
- No active disputes

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **NO** (not sensitive)
- Session freshness required: **NO**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- No other inputs required

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`PROGRESS_INITIATED`)
- Payment event triggered: **NO** (payments already charged in LOCK)
- Containers state: Set to `EMPTY` → ready for artifact placement
- AI visibility change: **NO**

**FAILURE HANDLING:**
- If room not in LOCKED: return `409 CONFLICT`
- If user not participant: return `403 FORBIDDEN`
- If payments not confirmed: return `402 PAYMENT_REQUIRED`
- If inactivity timeout exceeded: return `408 REQUEST_TIMEOUT`

**EDGE CASES (MANDATORY):**
- **Abuse:** Progress then retreat (no artifacts placed) → No retreat possible; once IN_PROGRESS, only forward or fail
- **Edge:** Progress mid-artifact upload → UI must prevent lock during upload; guard allows progress (artifact upload is async)

---

### TRANSITION 5: Seal Containers (ARTIFACT_PLACED → SEALED, then room IN_PROGRESS → UNDER_VALIDATION)

**Service Name:** `ContainerSealService`

**ENTITY:**
- Container (primary), Room (secondary)

**CURRENT STATE:**
- Container: ARTIFACT_PLACED
- Room: IN_PROGRESS

**ALLOWED NEXT STATE(S):**
- Container: SEALED
- Room: UNDER_VALIDATION (after both containers sealed)

**ACTOR ALLOWED:**
- ✅ Container owner (client or freelancer)
- ✅ Admin (can force seal)
- ❌ Counterparty (cannot seal other's container)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated (JWT valid)
- User is the container owner
- Container state is exactly `ARTIFACT_PLACED`
- Container has at least 1 artifact (not empty)
- All artifacts in container:
  - Have valid file hashes (SHA-256, 64 hex chars)
  - Are scanned or marked as scanned
  - Are not marked as infected
  - Meet file type whitelist (no executables, no scripts)
- Room state is exactly `IN_PROGRESS`
- No more than 100MB total per container
- Room has not exceeded inactivity timeout (168 hours from lock)

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **NO**
- Session freshness required: **NO**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `container_id`: UUID
- No other inputs required

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`SEAL_INITIATED` for container)
- Virus scan: Initiated (async) if not already complete
- AI visibility change: **YES** (AI gains read-only access to artifacts)
- Container state: SEALED
- Room state transition: If this seal operation results in both containers being SEALED, the guard MUST atomically trigger room state transition → UNDER_VALIDATION

**FAILURE HANDLING:**
- If container not owned by user: return `403 FORBIDDEN`
- If container state not ARTIFACT_PLACED: return `409 CONFLICT`
- If container empty: return `400 BAD_REQUEST` (with message "Container has no artifacts")
- If artifact infected: return `412 PRECONDITION_FAILED` (with message "Malware detected")
- If file type not whitelisted: return `400 BAD_REQUEST`
- If total size > 100MB: return `413 PAYLOAD_TOO_LARGE`
- If room not IN_PROGRESS: return `409 CONFLICT`
- If inactivity timeout exceeded: return `408 REQUEST_TIMEOUT`
- **Critical:** On error, container remains ARTIFACT_PLACED, room remains IN_PROGRESS

**EDGE CASES (MANDATORY):**
- **Abuse:** Seal then unseal → No unseal allowed after SEALED; once sealed, only forward (UNDER_VALIDATION, VALIDATED, TRANSFERRED)
- **Abuse:** Malicious artifact disguised as text → File type check: inspect magic bytes, not just extension
- **Abuse:** Container has 0 artifacts but metadata says 1 → Guard counts actual artifacts; mismatch triggers `400`
- **Edge:** Virus scanner timeout → Mark as pending; allow seal, but AI validation will flag as incomplete
- **Edge:** Both containers seal simultaneously → Race condition acceptable; both transition to SEALED; room transitions once both are sealed

---

### TRANSITION 6: Start Validation (SEALED → UNDER_VALIDATION at container & room level)

**Service Name:** `ContainerValidationStartService`

**ENTITY:**
- Container, Room

**CURRENT STATE:**
- Container: SEALED
- Room: UNDER_VALIDATION (or in transition to it)

**ALLOWED NEXT STATE(S):**
- Container: UNDER_VALIDATION
- Room: UNDER_VALIDATION

**ACTOR ALLOWED:**
- ✅ System (automated scheduler)
- ✅ Admin (manual trigger)
- ❌ System_AI (analysis only; cannot trigger transition)
- ❌ Client or Freelancer (cannot initiate; validation is automatic after seal)
- ❌ Anyone else (cannot)

**NOTE:** System_AI may generate validation summaries but cannot invoke state transitions.

**PRECONDITIONS (ALL MUST PASS):**
- Both containers are in SEALED state
- Room state is exactly UNDER_VALIDATION (set by second container seal)
- Virus scans complete (or marked timeout-ok)
- File hashes locked and immutable

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES** (if admin triggers)
- OTP required: **NO**
- Session freshness required: **NO**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- No manual container sealing order; system validates both sealed

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`VALIDATION_STARTED`)
- AI visibility change: **YES** (Gemini API called; AI analyzes artifacts)
- Validation summary generated: YES (placeholder stored in DB)
- AI awaits response: Async task scheduled

**FAILURE HANDLING:**
- If containers not both SEALED: return `409 CONFLICT`
- If room not UNDER_VALIDATION: return `409 CONFLICT`
- If virus scans pending: return `202 ACCEPTED` (still validating, check back later)

**EDGE CASES (MANDATORY):**
- **Abuse:** AI validation can be gamed (user uploads misleading artifacts) → Admin final review before SWAP_READY; AI is suggester only
- **Edge:** AI timeout (30 seconds) → Validation marked incomplete; Admin can still review and approve manually

---

### TRANSITION 7: Validate Success (UNDER_VALIDATION → VALIDATED)

**Service Name:** `RoomValidateSuccessService` or `AdminApproveValidationService`

**ENTITY:**
- Container, Room

**CURRENT STATE:**
- Container: UNDER_VALIDATION
- Room: UNDER_VALIDATION

**ALLOWED NEXT STATE(S):**
- Container: VALIDATED
- Room: SWAP_READY (if both containers VALIDATED)

**ACTOR ALLOWED:**
- ✅ Admin (final approval)
- ✅ System_AI (suggests, but does NOT execute state change)
- ❌ Client or Freelancer (cannot approve validation)
- ❌ Anyone else

**PRECONDITIONS (ALL MUST PASS):**
- Both containers in UNDER_VALIDATION
- Room in UNDER_VALIDATION
- AI validation summary exists (from Step 7)
- Admin has reviewed summary
- Validation decision recorded (APPROVED or REJECTED)
- Payment status confirmed (CONFIRMED for both parties, if required)
- No active disputes

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES** (admin only)
- OTP required: **YES** (validation approval is sensitive)
- Session freshness required: **YES** (< 10 min)
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- `validation_decision`: enum `['APPROVED', 'REJECTED']`
- `validation_reason`: optional string, max 1000 chars
- `admin_notes`: optional string, max 5000 chars

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`VALIDATION_APPROVED` with admin notes)
- Containers state: VALIDATED
- Room state: SWAP_READY (if both containers validated)
- Notification sent: **YES** (to both parties: "Validation passed, awaiting swap")

**FAILURE HANDLING:**
- If user not admin: return `403 FORBIDDEN`
- If containers not UNDER_VALIDATION: return `409 CONFLICT`
- If OTP invalid: return `401 UNAUTHORIZED`
- If session not fresh: return `401 UNAUTHORIZED`
- **Critical:** No state change if any precondition fails

**EDGE CASES (MANDATORY):**
- **Abuse:** Admin approves obviously fraudulent validation → Audit trail captures admin approval; later dispute can reference this
- **Edge:** Admin approval mid-artifact deletion (race) → Guard re-checks artifact integrity; if tampering detected, reject

---

### TRANSITION 8: Validate Failure (UNDER_VALIDATION → VALIDATION_FAILED)

**Service Name:** `RoomValidateFailureService`

**ENTITY:**
- Container, Room

**CURRENT STATE:**
- Container: UNDER_VALIDATION
- Room: UNDER_VALIDATION

**ALLOWED NEXT STATE(S):**
- Container: VALIDATION_FAILED
- Room: FAILED

**ACTOR ALLOWED:**
- ✅ Admin (can reject)
- ✅ System_AI (suggests rejection, but does NOT execute)
- ❌ Client or Freelancer (cannot reject)

**PRECONDITIONS (ALL MUST PASS):**
- Both containers in UNDER_VALIDATION (or one failed is enough?)
  - **Rule:** If ANY container fails validation, entire room fails
- Room in UNDER_VALIDATION
- Admin has reviewed and rejected
- Validation reason documented

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES** (admin)
- OTP required: **YES**
- Session freshness required: **YES**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- `validation_decision`: `'REJECTED'`
- `rejection_reason`: required string, max 1000 chars
- `admin_notes`: optional

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`VALIDATION_FAILED` with reason)
- Container state: VALIDATION_FAILED
- Room state: FAILED
- Artifacts remain sealed (not transferred)
- Placement + validation fees retained (non-refundable)
- Notification: **YES** (to both parties: "Validation failed")

**FAILURE HANDLING:**
- If not admin: return `403 FORBIDDEN`
- If containers not UNDER_VALIDATION: return `409 CONFLICT`
- If OTP invalid: return `401 UNAUTHORIZED`

**EDGE CASES (MANDATORY):**
- **Abuse:** Admin rejects valid work → Audit captures rejection; user can dispute and request manual review
- **Abuse:** User tampers with artifact after seal → File hash check fails; validation rejects

---

### TRANSITION 9: Atomic Swap (SWAP_READY → SWAPPED)

**Service Name:** `AtomicSwapExecutionService` (saga-based)

**ENTITY:**
- Room, Container (both A and B), Artifact, Payment

**CURRENT STATE:**
- Room: SWAP_READY
- Container A: VALIDATED
- Container B: VALIDATED

**ALLOWED NEXT STATE(S):**
- Room: SWAPPED
- Container A: TRANSFERRED
- Container B: TRANSFERRED

**ACTOR ALLOWED:**
- ✅ Admin (executes swap)
- ✅ System (automated after SWAP_READY, if conditions met)
- ❌ Client or Freelancer (cannot initiate)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS — ATOMIC CHECK):**
- Room state == SWAP_READY (checked at start of transaction)
- Container A state == VALIDATED
- Container B state == VALIDATED
- Both containers have artifacts
- Payment status == CONFIRMED (for all payers)
- No disputes on room
- Room has not exceeded total timeout (30 days from creation)
- All artifacts are immutable (file hashes locked)
- Swap operation has not been attempted before (idempotency check via DB flag)

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES** (if admin-triggered)
- OTP required: **NO** (system-triggered swaps bypass OTP)
- Session freshness required: **NO** (if system-triggered)
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- No other inputs required

**SIDE EFFECTS (MANDATORY — 4-STEP SAGA):**

**Step 1: Precondition Verification**
- All preconditions re-checked
- If any fail, entire saga aborts
- Audit log: `SWAP_PRECONDITIONS_VERIFIED` or `SWAP_PRECONDITIONS_FAILED`

**Step 2: Artifact Transfer**
- Container A artifacts → accessible to Freelancer (RLS updated)
- Container B artifacts → accessible to Client (RLS updated)
- Audit log: `SWAP_ARTIFACTS_TRANSFERRED`

**Step 3: Payment Release**
- Payment status set to FINAL (for escrow mode)
- Razorpay transfer order created (if funds in escrow)
- Audit log: `SWAP_PAYMENTS_RELEASED`

**Step 4: Final State Commit**
- Room state → SWAPPED
- Containers → TRANSFERRED
- Timestamp recorded
- Audit log: `SWAP_COMPLETED`
- Notification sent to both parties

**Transaction Model:** State mutations execute in a single atomic DB transaction. External side effects (storage moves, payment processing) execute as guarded saga steps with abort-on-failure semantics prior to final commit. If any step fails, entire saga rolls back and room remains SWAP_READY. Manual admin intervention required for recovery.

**FAILURE HANDLING:**
- If Room not SWAP_READY: return `409 CONFLICT`
- If Containers not VALIDATED: return `409 CONFLICT`
- If Payments not CONFIRMED: return `402 PAYMENT_REQUIRED`
- If Artifact tampering detected (hash mismatch): return `412 PRECONDITION_FAILED`
- If DB transaction fails: return `500 INTERNAL_SERVER_ERROR`; transaction rolled back automatically
- **Critical:** No partial success; either full swap or no changes

**EDGE CASES (MANDATORY):**
- **Abuse:** User downloads during swap → Access control RLS prevents unauthorized access; no manual file transfer needed
- **Abuse:** Swap attempted twice (idempotency) → Guard checks if swap already executed (flag in DB); second attempt returns `409 CONFLICT`
- **Edge:** Payment processor fails mid-swap → Transaction rolls back; room remains SWAP_READY; admin can retry
- **Edge:** Storage service down during artifact transfer → Transaction rolls back; no partial transfer
- **Edge:** Network timeout mid-transaction → DB enforces rollback; no orphaned state

---

### TRANSITION 10: Cancel Room (Any state → CANCELLED)

**Service Name:** `RoomCancelService`

**ENTITY:**
- Room

**CURRENT STATE:**
- Any of: ROOM_CREATED, INVITE_SENT, JOINED, LOCKED, IN_PROGRESS

**ALLOWED NEXT STATE(S):**
- CANCELLED

**ACTOR ALLOWED:**
- ✅ Room creator (can cancel before LOCKED)
- ✅ Either party (can cancel before UNDER_VALIDATION)
- ✅ Admin (can force cancel)
- ❌ After UNDER_VALIDATION (no cancellation; only FAILED or SWAPPED)

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated (JWT valid)
- User is room participant (creator, client, or freelancer)
- Room state is NOT in `[SWAPPED, FAILED, UNDER_VALIDATION, SWAP_READY, EXPIRED]` (forbidden cancel states)
- No active swap in progress
- If payments captured, provide cancellation reason

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **NO** (not sensitive)
- Session freshness required: **NO**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- `cancellation_reason`: optional string, max 500 chars

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`CANCELLED` with reason)
- Payment event: If LOCKED state, fees are NOT refunded (non-refundable)
- Artifacts deleted: **NO** (archived, not deleted)
- Containers remain sealed: **YES**
- Notification: **YES** (to other party)

**FAILURE HANDLING:**
- If user not participant: return `403 FORBIDDEN`
- If room in non-cancellable state: return `409 CONFLICT`
- If swap in progress: return `409 CONFLICT`

**EDGE CASES (MANDATORY):**
- **Abuse:** Cancel to avoid escrow reveal → User can cancel before UNDER_VALIDATION; after that, only admin can resolve disputes
- **Edge:** Cancel after partial payment → Placement fees retained; validation fees (if any) retained

---

### TRANSITION 11: Expire Room (INVITE_SENT or inactivity → EXPIRED)

**Service Name:** System job (cron task)

**ENTITY:**
- Room

**CURRENT STATE:**
- INVITE_SENT (if no one joins within 7 days)
- Any state (if no activity within TTL)

**ALLOWED NEXT STATE(S):**
- EXPIRED

**ACTOR ALLOWED:**
- ✅ System (automated)
- ❌ User (cannot expire manually)

**PRECONDITIONS (ALL MUST PASS):**
- Room.expires_at <= NOW()
- No recent activity (last action > 48 hours ago, configurable)
- Room state is not SWAPPED or FAILED

**SESSION & AUTH REQUIREMENTS:**
- None (system task)

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`EXPIRED`)
- Artifacts remain sealed
- Fees retained
- Notification sent: **YES** (to participants)
- Room locked from further action

**FAILURE HANDLING:**
- If room already SWAPPED/FAILED: skip expiry
- If expiry job fails: log error; retry on next cycle

**EDGE CASES (MANDATORY):**
- **Edge:** Room expires mid-swap → Impossible; swap completes within seconds, well before 48-hr timeout

---

## CONTAINER STATE TRANSITIONS

---

### TRANSITION C1: Create Container (implicit at room creation)

**Container starts in EMPTY state when room is created.**

**Service Name:** Implicit in `RoomCreateService`

**ENTITY:**
- Container

**CURRENT STATE:**
- N/A (new)

**ALLOWED NEXT STATE(S):**
- EMPTY

**PRECONDITIONS:**
- Room is created
- Two containers (A and B) created atomically
- Container A assigned to client (or creator in MUTUAL_TRANSFER)
- Container B assigned to freelancer (or invitee)

**SIDE EFFECTS:**
- Audit log: **YES** (implicit in room creation audit)
- Containers initialized with empty file list

---

### TRANSITION C2: Artifact Placement (EMPTY → ARTIFACT_PLACED)

**Service Name:** `ArtifactCreateService`

**ENTITY:**
- Container

**CURRENT STATE:**
- EMPTY or ARTIFACT_PLACED (additive)

**ALLOWED NEXT STATE(S):**
- ARTIFACT_PLACED (once at least one artifact exists)

**ACTOR ALLOWED:**
- ✅ Container owner only
- ❌ Counterparty (cannot upload to other's container)
- ❌ Admin (cannot override unless container stuck)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS):**
- User is authenticated
- User is container owner
- Container state is EMPTY or ARTIFACT_PLACED (same state transition)
- Room state is exactly IN_PROGRESS
- Artifact file:
  - Size > 0 bytes and <= 50MB individual file
  - Total container size <= 100MB
  - MIME type in whitelist (no executables, no scripts)
  - File hash (SHA-256) is unique within room
  - No virus signature match (ClamAV scan)
  - Filename valid (length 1-256, no path traversal)
- Container not sealed yet

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **NO**
- Session freshness required: **NO**
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `container_id`: UUID
- `file`: binary, max 50MB
- `filename`: string, length 1-256, no `../`, no null bytes
- `mime_type`: string, must be from whitelist

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`ARTIFACT_UPLOADED`)
- Virus scan: Initiated (async), result stored
- File hash stored: YES (SHA-256, immutable)
- Artifact DB record created
- Container state (if new): ARTIFACT_PLACED

**FAILURE HANDLING:**
- If user not owner: return `403 FORBIDDEN`
- If container sealed: return `409 CONFLICT` (with message "Container sealed; no uploads allowed")
- If room not IN_PROGRESS: return `409 CONFLICT`
- If file too large: return `413 PAYLOAD_TOO_LARGE`
- If MIME type not whitelisted: return `400 BAD_REQUEST`
- If file infected: return `400 BAD_REQUEST` (with message "File contains malware")
- If upload fails (storage error): return `507 INSUFFICIENT_STORAGE`
- **Critical:** If any validation fails, no artifact created

**EDGE CASES (MANDATORY):**
- **Abuse:** Upload same file twice (by hash) → Guard allows (user may want redundancy); audit captures both
- **Abuse:** Upload file named "virus.txt" that contains PE header → MIME validation + ClamAV both reject
- **Abuse:** Symlink or hardlink to another user's file → Storage service prevents; only direct uploads allowed
- **Edge:** Upload during network disconnect → Client-side resume; server sees partial upload; guard rejects if incomplete
- **Edge:** Concurrent uploads to same container → Both succeed; container transitions once to ARTIFACT_PLACED

---

### TRANSITION C3: Seal Container (ARTIFACT_PLACED → SEALED)

**See TRANSITION 6 above (container sealing is primary focus there)**

---

### TRANSITION C4: Start Validation (SEALED → UNDER_VALIDATION)

**See TRANSITION 7 above**

---

### TRANSITION C5: Validate Success (UNDER_VALIDATION → VALIDATED)

**See TRANSITION 8 above**

---

### TRANSITION C6: Validate Failure (UNDER_VALIDATION → VALIDATION_FAILED)

**See TRANSITION 9 above**

---

### TRANSITION C7: Transfer (VALIDATED → TRANSFERRED)

**Part of atomic swap (TRANSITION 10). Container moves to TRANSFERRED when swap executes.**

**Service Name:** `AtomicSwapExecutionService` (Step 2)

**ENTITY:**
- Container

**CURRENT STATE:**
- VALIDATED

**ALLOWED NEXT STATE(S):**
- TRANSFERRED

**PRECONDITIONS:**
- Atomic swap executing
- Payment confirmed
- Artifacts immutable

**SIDE EFFECTS:**
- RLS policies updated to allow counterparty artifact access
- Audit log: `SWAP_ARTIFACTS_TRANSFERRED`

---

## PAYMENT STATE TRANSITIONS

### NOTE: Payment Terminal States (Normalization)

Payment lifecycle terminal states are:
- **FINAL**: Successful completion; funds transferred to payee or held in escrow
- **REFUNDED**: Post-final reversal (from CONFIRMED only); created only when admin issues refund on platform fault
- **FAILED**: Unsuccessful attempt; payment never confirmed and never reached escrow

No payment may transition out of a terminal state.

---

### TRANSITION P1: Create Payment (Initial)

**Service Name:** `PaymentCreateService`

**ENTITY:**
- Payment

**CURRENT STATE:**
- N/A (new)

**ALLOWED NEXT STATE(S):**
- PENDING

**ACTOR ALLOWED:**
- ✅ System (creates payment records)
- ✅ User (initiates payment flow)
- ❌ Admin (cannot create payments directly)

**PRECONDITIONS (ALL MUST PASS):**
- Room in LOCKED state (payment triggered by lock)
- User is room participant (payer)
- Payment type is in `['PLACEMENT_FEE', 'VALIDATION_FEE', 'ESCROW']`
- Amount calculated correctly:
  - PLACEMENT_FEE: 5% of room.amount_total
  - VALIDATION_FEE: 6% of room.amount_total (for validation-required mode)
  - ESCROW: full room.amount_total (client side only, for escrow mode)
- No duplicate payment for same type/payer combo (UNIQUE constraint)
- Payment provider order created (Razorpay)

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES**
- OTP required: **YES** (payment is sensitive)
- Session freshness required: **YES** (< 5 min)
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `room_id`: UUID
- `payment_type`: enum
- `amount`: decimal, must match calculated fee
- `payer_email`: must match authenticated user email

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`PAYMENT_INITIATED`)
- Razorpay order created (state: CREATED)
- Payment record: PENDING status
- User redirected to Razorpay checkout
- Payment will eventually reach terminal state (FINAL, FAILED, or REFUNDED)

**FAILURE HANDLING:**
- If room not LOCKED: return `409 CONFLICT`
- If user not participant: return `403 FORBIDDEN`
- If OTP invalid: return `401 UNAUTHORIZED`
- If Razorpay API fails: return `502 BAD_GATEWAY`; no payment record created
- If duplicate payment exists: return `409 CONFLICT`

**EDGE CASES (MANDATORY):**
- **Abuse:** User initiates payment then closes browser → Payment status remains PENDING; user can retry with same order ID (idempotent)
- **Abuse:** Payment processor returns error code → Guard checks Razorpay error; if transient, allow retry
- **Edge:** Amount miscalculation (user pays wrong amount) → Razorpay verifies; if mismatch, webhook rejects

---

### TRANSITION P2: Payment Confirmed (PENDING → CONFIRMED)

**Service Name:** `PaymentConfirmedWebhookService`

**ENTITY:**
- Payment

**CURRENT STATE:**
- PENDING

**ALLOWED NEXT STATE(S):**
- CONFIRMED

**ACTOR ALLOWED:**
- ✅ Razorpay webhook (verified signature)
- ❌ User (cannot confirm directly)
- ❌ Admin (cannot force confirm)

**PRECONDITIONS (ALL MUST PASS):**
- Webhook signature verified (HMAC SHA256 with Razorpay secret)
- Webhook not replayed (idempotency key checked)
- Payment status in Razorpay: CAPTURED or COMPLETED
- Payment amount matches order amount
- Payer ID matches
- Room state is LOCKED or IN_PROGRESS (not post-seal)

**SESSION & AUTH REQUIREMENTS:**
- None (webhook)

**INPUT VALIDATION RULES:**
- Webhook payload validated against Razorpay schema
- `payment_id`: string (Razorpay payment ID)
- `order_id`: string (Razorpay order ID)
- `amount`: integer (paise, e.g., 500 = 5 INR)
- `signature`: string (HMAC)

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`PAYMENT_CONFIRMED`)
- Payment status: CONFIRMED
- Room state progression allowed (if needed for lock)

**FAILURE HANDLING:**
- If signature invalid: return `401 UNAUTHORIZED`; log security event
- If idempotency key seen before: return `200 OK`; no state change (duplicate webhook)
- If payment status not CAPTURED: return `400 BAD_REQUEST`
- If amount mismatch: return `400 BAD_REQUEST`; log fraud alert
- **Critical:** Webhook processing is idempotent; no side effects beyond first confirmation

**EDGE CASES (MANDATORY):**
- **Abuse:** Webhook replayed 1000 times → Idempotency check prevents state mutation on repeats
- **Abuse:** Attacker sends fake webhook with valid amount → Signature verification prevents; audit logs attempt
- **Edge:** Webhook arrives before client receives response → Idempotency ensures consistency

---

### TRANSITION P3: Payment Failed (PENDING → FAILED)

**Service Name:** `PaymentFailedWebhookService`

**ENTITY:**
- Payment

**CURRENT STATE:**
- PENDING

**ALLOWED NEXT STATE(S):**
- FAILED

**ACTOR ALLOWED:**
- ✅ Razorpay webhook (verified)
- ❌ User or Admin

**PRECONDITIONS:**
- Webhook signature verified
- Razorpay payment status: FAILED or CANCELLED
- Idempotency check passed

**SIDE EFFECTS:**
- Audit log entry: **YES** (`PAYMENT_FAILED`)
- Payment status: FAILED
- Room state: Remains JOINED or LOCKED (no backward transition)
- User notified: YES (payment attempt failed; can retry)

**FAILURE HANDLING:**
- If signature invalid: log security event
- If idempotent replay: no state change

---

### TRANSITION P4: Refund (CONFIRMED → REFUNDED)

**Service Name:** `PaymentRefundService`

**ENTITY:**
- Payment

**CURRENT STATE:**
- CONFIRMED (can only refund confirmed payments)

**ALLOWED NEXT STATE(S):**
- REFUNDED

**ACTOR ALLOWED:**
- ✅ Admin (can issue refunds on platform fault)
- ❌ User (cannot self-refund)
- ❌ System_AI (cannot)

**PRECONDITIONS (ALL MUST PASS):**
- User is Admin
- Payment status is CONFIRMED
- Room state is in `[FAILED, CANCELLED, EXPIRED]` (only refund in failure cases)
- Refund reason documented (platform fault, user error, etc.)
- No refund already issued for this payment

**SESSION & AUTH REQUIREMENTS:**
- Authentication required: **YES** (admin)
- OTP required: **YES**
- Session freshness required: **YES** (< 10 min)
- Allowed email domains: `gmail.com`, `yahoo.com`

**INPUT VALIDATION RULES:**
- `payment_id`: UUID
- `refund_reason`: required string, max 1000 chars
- `admin_id`: admin's user ID (verified from JWT)

**SIDE EFFECTS (MANDATORY):**
- Audit log entry: **YES** (`REFUND_INITIATED`)
- Razorpay refund API called
- Refund order created (async tracking)
- Payment status → REFUNDED (when refund confirmed by Razorpay webhook)

**FAILURE HANDLING:**
- If user not admin: return `403 FORBIDDEN`
- If payment not CONFIRMED: return `409 CONFLICT`
- If room not in refundable state: return `409 CONFLICT`
- If Razorpay refund fails: return `502 BAD_GATEWAY`; audit logs failure; admin can retry

**EDGE CASES (MANDATORY):**
- **Abuse:** Admin issues refund without justification → Audit trail captures admin ID and reason; owner can dispute
- **Edge:** Refund processing takes 3-5 business days (Razorpay) → Payment marked as REFUND_PENDING until webhook confirms

---

## SESSION & AUTH TRANSITIONS

---

### TRANSITION S1: Signup (Create Profile + Initiate OTP)

**Service Name:** `AuthSignupService`

**ENTITY:**
- Profile, Session

**CURRENT STATE:**
- N/A (new user)

**ALLOWED NEXT STATE(S):**
- Profile created (role: CLIENT or FREELANCER)
- Session: OTP_PENDING

**ACTOR ALLOWED:**
- ✅ Any new user (email-only)
- ❌ Existing users (already have profile)

**PRECONDITIONS (ALL MUST PASS):**
- Email is unique in DB
- Email domain in `['gmail.com', 'yahoo.com']` (HARD CHECK)
- Email format valid (RFC 5322 simplified check)
- No bot behavior detected (rate limit)
- No disposable email (check against list)

**SESSION & AUTH REQUIREMENTS:**
- Authentication: **NO** (pre-auth flow)
- OTP required: **YES** (after signup)
- Session: OTP_PENDING (not logged in yet)

**INPUT VALIDATION RULES:**
- `email`: string, lowercase, trimmed, domain validated
- `password`: min 12 chars, complexity requirements (1 upper, 1 lower, 1 number, 1 special)
- `role`: enum `['CLIENT', 'FREELANCER']`
- `agree_to_terms`: boolean, must be true

**SIDE EFFECTS (MANDATORY):**
- Profile created in DB (role set)
- OTP generated (6 digits, 10-minute TTL)
- OTP sent via email
- Audit log: **YES** (`SIGNUP_INITIATED`)
- Session created: OTP_PENDING state

**FAILURE HANDLING:**
- If email domain not whitelisted: return `400 BAD_REQUEST` (with message "Email domain not supported")
- If email already exists: return `409 CONFLICT` (no user enumeration; return same message as success)
- If email is disposable: return `400 BAD_REQUEST` (with message "Email not accepted")
- If password too weak: return `400 BAD_REQUEST` (with detailed requirements)
- If terms not agreed: return `400 BAD_REQUEST`
- If rate limited (> 5 signups per IP per hour): return `429 TOO_MANY_REQUESTS`

**EDGE CASES (MANDATORY):**
- **Abuse:** Enumerate users by comparing signup response times → Guard returns same response time for all (constant-time response)
- **Abuse:** Signup with `+` alias (e.g., `name+tag@gmail.com`) → Guard normalizes; duplicate if same base email
- **Abuse:** Rapid signup with similar emails → Rate limit per IP
- **Edge:** OTP expires before user verifies → User can request new OTP (max 3 attempts)

---

### TRANSITION S2: Verify OTP (OTP_PENDING → LOGGED_IN)

**Service Name:** `AuthVerifyOTPService`

**ENTITY:**
- Session, Profile

**CURRENT STATE:**
- OTP_PENDING

**ALLOWED NEXT STATE(S):**
- LOGGED_IN

**ACTOR ALLOWED:**
- ✅ User with valid OTP
- ❌ Other users (cannot use someone else's OTP)

**PRECONDITIONS (ALL MUST PASS):**
- Session is in OTP_PENDING state
- OTP is correct (case-insensitive)
- OTP not expired (10-minute TTL)
- OTP not used before
- User email verified (implied by OTP receipt)

**SESSION & AUTH REQUIREMENTS:**
- Authentication: **NO** (pre-auth)
- OTP required: **YES** (being verified)
- Session: LOGGED_IN (after verification)

**INPUT VALIDATION RULES:**
- `email`: string (should match session email)
- `otp`: 6-digit string or number
- `session_id`: UUID (temporary session token)

**SIDE EFFECTS (MANDATORY):**
- JWT issued (valid 30 days, with `iat` and `exp` claims)
- Session marked: LOGGED_IN
- OTP marked: USED
- Audit log: **YES** (`SIGNUP_OTP_VERIFIED`)
- Profile now accessible

**FAILURE HANDLING:**
- If OTP incorrect: return `401 UNAUTHORIZED` (do not reveal if wrong OTP or expired)
- If OTP expired: return `401 UNAUTHORIZED`
- If OTP used before: return `401 UNAUTHORIZED`
- If max attempts reached (3): return `429 TOO_MANY_REQUESTS`; lock account for 15 minutes

**EDGE CASES (MANDATORY):**
- **Abuse:** OTP brute force (try all 1 million combinations) → Rate limit: 3 wrong attempts → 15-min lockout
- **Abuse:** OTP replay from email forward → OTP marked as used; second attempt rejected
- **Edge:** User closes browser mid-OTP entry → Session expires; user restarts flow

---

### TRANSITION S3: Login (Email + Password → OTP_PENDING or LOGGED_IN if trusted device)

**Service Name:** `AuthLoginService`

**ENTITY:**
- Session

**CURRENT STATE:**
- UNAUTHENTICATED

**ALLOWED NEXT STATE(S):**
- OTP_PENDING (new device)
- LOGGED_IN (trusted device with recent OTP verification)

**ACTOR ALLOWED:**
- ✅ Any registered user
- ❌ Unregistered users (return generic error)

**PRECONDITIONS (ALL MUST PASS):**
- Email domain is whitelisted
- Email exists in system (or return generic error for privacy)
- Password correct (bcrypt verified)
- Account not locked (max failed attempts: 5 → 30-min lockout)
- Account not suspended

**SESSION & AUTH REQUIREMENTS:**
- Authentication: **NO** (pre-auth)
- OTP required: **YES** (unless trusted device)
- Session: OTP_PENDING or LOGGED_IN

**INPUT VALIDATION RULES:**
- `email`: valid format
- `password`: string, min 12 chars
- `device_fingerprint`: optional (browser/device ID for trusted device detection)

**SIDE EFFECTS (MANDATORY):**
- Login attempt logged: **YES** (audit log)
- OTP generated (if new device or OTP expired)
- OTP sent via email
- Device fingerprint stored (for subsequent logins)

**FAILURE HANDLING:**
- If password incorrect: return `401 UNAUTHORIZED` (generic message)
- If account locked: return `403 FORBIDDEN` (with retry-after header)
- If account suspended: return `403 FORBIDDEN`
- If email not found: return `401 UNAUTHORIZED` (same message as wrong password; no user enumeration)

**EDGE CASES (MANDATORY):**
- **Abuse:** Brute force password → Rate limit: 5 wrong attempts → 30-min lockout per IP + per account
- **Abuse:** Trusted device re-login → Device fingerprint checked; if device changed, require OTP
- **Edge:** User logs in from 5 different countries in 1 hour → Flag as suspicious; still allow (audit for later review)

---

### TRANSITION S4: Request Fresh OTP (For Sensitive Transitions)

**Service Name:** `AuthRefreshOTPService`

**ENTITY:**
- Session

**CURRENT STATE:**
- LOGGED_IN (but old session, > 5 min)

**ALLOWED NEXT STATE(S):**
- LOGGED_IN_FRESH (after OTP verification)

**ACTOR ALLOWED:**
- ✅ Authenticated user
- ❌ Unauthenticated

**PRECONDITIONS:**
- User is authenticated (JWT valid)
- Session age > 5 minutes (if sensitive operation imminent)

**SIDE EFFECTS:**
- OTP generated (for re-verification)
- OTP sent via email
- Audit log: **YES** (`FRESH_OTP_REQUESTED`)

**FAILURE HANDLING:**
- If user not authenticated: return `401 UNAUTHORIZED`

---

## GLOBAL INPUT SANITIZATION

All inputs must be sanitized at the guard level:

### String Fields
- Trim whitespace
- Validate length (min, max)
- Reject null bytes
- Reject Unicode extremes (control characters, private use areas)
- Escape HTML if stored (but prefer parameterized queries in ORM)

### UUID Fields
- Validate format (36-character hex + hyphens)
- Reject if not valid UUID v4

### Numeric Fields
- Validate type (must be number, not string)
- Validate range (min, max)
- For decimals: exactly 2 decimal places (monetary values)

### Email Fields
- Validate format (RFC 5322 simplified)
- Lowercase
- Domain must be whitelisted

### Enums
- Strict whitelist (no typos accepted)
- Case-insensitive for some (OTP, passwords)
- Reject unknown values

### File Fields
- Size <= stated limit
- MIME type validated (magic bytes, not just extension)
- Filename sanitized (no path traversal, no null bytes)

### JSON Fields (e.g., validation_details)
- Validate structure (no deep nesting > 10 levels)
- Reject large payloads (> 10MB)
- Reject circular references

---

## RATE LIMITING

All transitions must enforce rate limits:

### Per-User Rate Limits
- Signup: 5 per hour per IP
- Login: 5 per hour per account (after 5 failures, lock for 30 min)
- OTP request: 3 per 10 minutes per email
- Room creation: 5 per hour per user
- Artifact upload: 10 per room per hour per user
- State transitions: 10 per room per hour per actor

### Per-IP Rate Limits
- Login: 20 per hour per IP (across all accounts)
- Signup: 10 per hour per IP
- Room creation: 50 per hour per IP

### Webhook Rate Limits
- Razorpay webhooks: No rate limit (trusted source); idempotency by key instead

---

## ERROR RESPONSES (STANDARDIZED)

All guard failures must return standardized error response:

```json
{
  "statusCode": 400,
  "error": "BadRequest",
  "message": "Human-readable error message (no technical details)",
  "timestamp": "2026-01-22T10:30:00Z",
  "path": "/api/room/lock",
  "requestId": "uuid-of-request"
}
```

Status codes used:
- `400 BAD_REQUEST`: Input validation failure
- `401 UNAUTHORIZED`: Auth or session failure
- `402 PAYMENT_REQUIRED`: Payment not confirmed
- `403 FORBIDDEN`: Authorization failure (wrong actor)
- `404 NOT_FOUND`: Resource not found
- `409 CONFLICT`: State conflict (invalid transition)
- `410 GONE`: Resource expired
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded
- `500 INTERNAL_SERVER_ERROR`: Server fault (do not expose details)
- `502 BAD_GATEWAY`: External service failure (Razorpay, storage)
- `503 SERVICE_UNAVAILABLE`: Transient service failure

---

## AUDIT LOGGING FORMAT (MANDATORY)

Every state transition must produce an audit log:

```sql
INSERT INTO public.audit_logs (
  room_id,
  actor_id,
  actor_role,
  action,
  previous_state,
  new_state,
  metadata,
  performed_at
) VALUES (...)
```

Fields:
- `action`: enum string (e.g., `LOCK_INITIATED`, `ARTIFACT_UPLOADED`, `VALIDATION_APPROVED`)
- `previous_state`: exact state before transition
- `new_state`: exact state after transition (or NULL if action is read-only)
- `metadata`: JSONB with contextual data:
  - `guard_name`: which guard enforced this
  - `input_size`: size of request payload
  - `duration_ms`: execution time
  - `error`: if transition failed, error message
  - `actor_email`: for non-system actors
  - `payment_id`: if payment involved
  - `reason`: if cancellation or rejection

Example:
```json
{
  "guard_name": "LockRoomGuard",
  "input_size": 124,
  "duration_ms": 452,
  "payment_id": "uuid-of-placement-fee",
  "otp_verified": true,
  "session_age_seconds": 120
}
```

---

## SELF-CHECK VERIFICATION (MANDATORY)

Before implementing, verify:

- ✅ **No transition violates docs/state-machine.md**
  - Checked: All transitions match allowed paths
  - Forbidden: No backward transitions allowed
  - Forbidden: No state skipping
  - Checked: Atomic swap has 4-step saga

- ✅ **No actor gains extra power**
  - Client: Can create room, join, upload artifacts, seal own container, view validation result
  - Freelancer: Same as client (symmetrical)
  - Admin: Can read all, approve/reject validation, force cancel, issue refunds, view audit
  - System_AI: Read-only, suggest-only, cannot execute state changes
  - No privilege escalation via profile mutation (RLS forbids update)

- ✅ **No session loophole**
  - All transitions require JWT (except pre-auth flows)
  - Sensitive transitions (lock, payment, seal) require fresh session < 5 min
  - OTP required for first signup, first login, payments, room lock
  - Session fixation: Impossible (new JWT per login)
  - Session replay: Impossible (JWT exp checked, nonce in OTP)

- ✅ **No payment shortcut**
  - Payment creation required before LOCK
  - Payment confirmation required before state progression (checked in preconditions)
  - Payment failure does not mutate room state
  - Refunds are new payment events, not updates
  - Razorpay webhook signature verified
  - Webhook idempotency prevents duplicate charges

- ✅ **No identity leak**
  - Client and Freelancer never see each other's email in room
  - Responses are identical for "user not found" vs "user exists" (no enumeration)
  - Audit logs show only actor role, not email (privacy)
  - Artifacts visible only after VALIDATED or TRANSFERRED (RLS enforced)
  - API responses do not include counterparty email

- ✅ **All inputs validated**
  - Email domain whitelist enforced
  - UUID format validated
  - Enum values strict
  - String lengths enforced
  - File sizes enforced
  - Numeric ranges enforced
  - No null bytes
  - No HTML injection (sanitized)

- ✅ **All failures are silent or minimal**
  - No detailed error messages that leak information
  - No stack traces returned to client
  - Rate limit responses do not reveal attempt counts
  - Failed auth returns same message as other failures

---

## FINAL NOTES

This specification is **non-negotiable**.

Any deviation is a **security defect**.

Every line of backend code that touches state transitions must pass through these guards.

The database layer (schema.sql, policies.sql) provides **second-layer enforcement**.
The guard layer provides **first-layer enforcement**.

Together, they form an **unbreakable chain of custody**.

---

**END OF SPECIFICATION**
