# ENCLOSURE — ROOM & CONTAINER STATE MACHINE
## (Authoritative System Contract)

This document defines the **only valid states, transitions, and enforcement rules**
for ENCLOSURE.  
All backend logic, payments, validation, and UI behavior MUST strictly follow
this contract.

No state skipping, no backward transitions, and no undocumented overrides
are permitted.

---

## 1. ROOM STATE MACHINE

### 1.1 Room States (Final & Exhaustive)

```

ROOM_CREATED
INVITE_SENT
JOINED
LOCKED
IN_PROGRESS
UNDER_VALIDATION
SWAP_READY
SWAPPED
CANCELLED
FAILED
EXPIRED

```

---

### 1.2 Allowed Transitions

```

ROOM_CREATED     → INVITE_SENT
INVITE_SENT      → JOINED
JOINED           → LOCKED
LOCKED           → IN_PROGRESS
IN_PROGRESS      → UNDER_VALIDATION
UNDER_VALIDATION → SWAP_READY
SWAP_READY       → SWAPPED

```

---

### 1.3 Failure / Exit Transitions

```

ROOM_CREATED     → CANCELLED
INVITE_SENT      → EXPIRED
JOINED           → CANCELLED
LOCKED           → CANCELLED
IN_PROGRESS      → FAILED
UNDER_VALIDATION → FAILED
SWAP_READY       → FAILED

```

---

### 1.4 State Rules (Hard Constraints)

**ROOM_CREATED**
- Room initialized
- No artifacts allowed
- No fees charged

**INVITE_SENT**
- Invite link issued
- Awaiting counterparty join

**JOINED**
- Both parties present
- Scope review allowed
- No artifact placement yet

**LOCKED**
- Scope frozen
- Placement and validation fees captured
- No edits permitted

**IN_PROGRESS**
- Artifact placement allowed
- No scope changes

**UNDER_VALIDATION**
- Containers sealed
- No uploads allowed
- AI/Admin read-only validation

**SWAP_READY**
- All validations passed
- Awaiting atomic swap

**SWAPPED**
- Final, irreversible state
- Files and/or funds transferred

**CANCELLED**
- Voluntary termination
- No transfers occur

**FAILED**
- Validation or rule violation
- Fees retained
- No transfers occur

**EXPIRED**
- Time-to-live exceeded
- No transfers occur
- Fees retained

---

### 1.5 Forbidden Transitions (ABSOLUTE)

```

SWAPPED          → ANY
FAILED           → IN_PROGRESS
CANCELLED        → IN_PROGRESS
LOCKED           → ROOM_CREATED
UNDER_VALIDATION → IN_PROGRESS

```

Any attempt to perform a forbidden transition MUST:
- Be rejected
- Be audit-logged

---

## 2. CONTAINER STATE MACHINE

Each room contains **two logical containers** (A-side and B-side).
Both containers follow identical rules.

---

### 2.1 Container States

```

EMPTY
ARTIFACT_PLACED
SEALED
UNDER_VALIDATION
VALIDATED
VALIDATION_FAILED
TRANSFERRED

```

---

### 2.2 Allowed Transitions

```

EMPTY            → ARTIFACT_PLACED
ARTIFACT_PLACED  → SEALED
SEALED           → UNDER_VALIDATION
UNDER_VALIDATION → VALIDATED
UNDER_VALIDATION → VALIDATION_FAILED
VALIDATED        → TRANSFERRED

```

---

### 2.3 Container State Rules

**EMPTY**
- No artifacts present

**ARTIFACT_PLACED**
- Artifacts uploaded
- Placement fee charged
- Virus scan executed

**SEALED**
- Uploads disabled
- File hashes locked

**UNDER_VALIDATION**
- AI/Admin read-only access
- No mutation allowed

**VALIDATED**
- Artifacts confirmed to meet scope
- Eligible for swap

**VALIDATION_FAILED**
- Artifacts rejected
- No retry without new room

**TRANSFERRED**
- Files released to counterparty
- Access granted
- Final state

---

### 2.4 Forbidden Container Transitions

```

TRANSFERRED       → ANY
VALIDATION_FAILED → VALIDATED
SEALED            → ARTIFACT_PLACED
UNDER_VALIDATION  → ARTIFACT_PLACED

```

All violations MUST be rejected and logged.

---

## 3. ATOMIC SWAP CONDITION (CRITICAL)

A swap occurs **if and only if** ALL of the following are true:

```

Room.State            == SWAP_READY
Container_A.State     == VALIDATED
Container_B.State     == VALIDATED
Payment.Status        == CONFIRMED

```

If ANY condition fails:
- No transfer occurs
- No funds are released

---

## 4. FAILURE HANDLING (ABUSE-RESISTANT)

### Validation Failure
- Containers → VALIDATION_FAILED
- Room → FAILED
- Placement + validation fees retained
- No artifacts released
- Only high-level summary shown to users

---

### Timeout / Inactivity
- No required action within TTL
- Room → EXPIRED
- Containers remain sealed
- Fees retained

---

### Payment Failure
- Payment not confirmed
- Room cannot transition to LOCKED
- Artifact placement forbidden

---

### Platform or AI Fault
- Admin may:
  - Reset validation state
  - Refund placement and validation fees
- Reason MUST be recorded
- Action MUST be audit-logged

---

## 5. ADMIN OVERRIDE BOUNDARIES (STRICT)

### Admin MAY:
- Force `UNDER_VALIDATION → VALIDATED`
- Force `UNDER_VALIDATION → VALIDATION_FAILED`
- Cancel room before SWAP
- Trigger refunds on platform fault

### Admin MAY NOT:
- Force `SWAPPED`
- Modify or replace artifacts
- Bypass payment confirmation
- Reverse `SWAPPED`

All overrides:
- Require explicit reason
- Are permanently audit-logged
- Appear in final PDF report

---

## 6. SECURITY INVARIANTS (NON-NEGOTIABLE)

The following MUST always hold true:

1. No artifact released before validation
2. No funds released before swap
3. No identity visibility between parties
4. No backward state transitions
5. Every transition is audit-logged
6. Every decision is replayable

---

## 7. WHY THIS IS ABUSE-RESISTANT

- Free testing is impossible
- Collusion incurs monetary cost
- Partial swaps are forbidden
- Manual overrides are constrained
- Audit trail cannot be erased

---

## 8. IMPLEMENTATION NOTE

Any code path that violates this document
is considered a **critical security defect**.

This document is the system contract.

