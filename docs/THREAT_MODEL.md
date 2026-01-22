# ENCLOSURE Threat Model

This document defines the **explicit threat model** for the ENCLOSURE protocol.

It enumerates:

* Assumed attacker capabilities
* Assets under protection
* Threat classes
* Enforced mitigations
* Non-goals and accepted risks

This is an **authoritative security contract**, not a theoretical exercise.

---

## Security Posture

ENCLOSURE operates under a **zero-trust assumption**.

All actors — users, admins, AI systems, infrastructure, and integrations — are assumed to be:

* Potentially malicious
* Fallible
* Compromisable

Security is enforced **by construction**, not by policy or intent.

---

## Assets Under Protection

ENCLOSURE explicitly protects the following assets:

### 1. Digital Artifacts

* Uploaded files and work outputs
* File hashes, metadata, and storage locations

### 2. Economic Value

* Escrowed payments
* Validation fees
* Settlement guarantees

### 3. State Integrity

* Room, container, artifact, and payment states
* Transition order and irreversibility

### 4. Identity Boundaries

* Separation between parties
* Role isolation (Client, Freelancer, Admin, System)

### 5. Audit Integrity

* Append-only audit logs
* Non-repudiation of actions

---

## Adversary Model

ENCLOSURE assumes attackers may include:

### External Attackers

* Anonymous internet users
* Credential stuffers
* Bot-driven abuse
* API fuzzers

### Malicious Participants

* A client attempting to steal work
* A freelancer attempting to extract funds early
* A party attempting to bypass validation

### Privileged Attackers

* Compromised admin accounts
* Rogue insiders
* Misconfigured service roles

### Infrastructure-Level Threats

* Leaked API keys
* Compromised webhooks
* Partial database exposure
* Storage bucket misconfiguration

---

## Explicit Threat Classes & Mitigations

### T1: Unauthorized State Transition

**Threat**
An attacker attempts to force or skip a state transition.

**Mitigations**

* State machine enforced at service layer
* Guards validate role + state preconditions
* RLS denies direct UPDATE access
* Transitions only allowed via named services
* All attempts logged to immutable audit trail

---

### T2: Partial or Double Execution

**Threat**
Repeated requests cause duplicate side effects (double payment, double swap).

**Mitigations**

* Mandatory idempotency keys (5-minute window)
* Audit log checked before execution
* External providers (payments, storage) used in idempotent mode
* Replay-safe saga orchestration

---

### T3: Artifact Theft or Premature Access

**Threat**
A party attempts to access artifacts before validation or transfer.

**Mitigations**

* Container state gating (`VALIDATED` / `TRANSFERRED`)
* Signed, time-limited URLs only
* No artifact streaming through backend
* Mandatory audit logging for all non-owner views

---

### T4: Privilege Escalation

**Threat**
A user attempts to gain admin or system privileges.

**Mitigations**

* Authorization based on JWT claims, not mutable profiles
* Guards enforce role invariants
* Admin actions restricted to specific transitions
* No role-based bypass of artifact access

---

### T5: Silent Data Exfiltration

**Threat**
Artifacts or metadata accessed without trace.

**Mitigations**

* Mandatory audit logging for all reads
* Append-only audit table (no DELETE/UPDATE)
* Audit logs generated before and after access
* Admin access logged explicitly

---

### T6: AI Overreach

**Threat**
AI system mutates state or leaks sensitive data.

**Mitigations**

* AI is strictly read-only
* AI has no write permissions
* AI output stored as informational metadata only
* AI cannot trigger state transitions

---

### T7: Payment Manipulation

**Threat**
Forged or replayed payment confirmations.

**Mitigations**

* Webhook signature verification
* Idempotent payment processing
* Payment transitions driven only by provider callbacks
* No client-initiated payment state changes

---

### T8: Replay & Race Conditions

**Threat**
Concurrent requests exploit timing gaps.

**Mitigations**

* Row-level locks where required
* Idempotency enforced before mutation
* Saga coordination with explicit failure isolation
* Deterministic execution order

---

### T9: Audit Log Tampering

**Threat**
An attacker attempts to delete or alter audit records.

**Mitigations**

* Append-only audit table
* RLS denies UPDATE and DELETE
* No admin override for audit mutation
* Immutable timestamps

---

## Non-Goals (Explicitly Out of Scope)

ENCLOSURE **does not attempt to protect against**:

* User device compromise
* Screen recording or manual copying by a legitimate recipient
* Social engineering outside the protocol
* Denial-of-service at the network level
* Compromise of external providers (assumed but isolated)

These risks are accepted and documented.

---

## Failure Philosophy

ENCLOSURE is designed to:

* **Fail closed**, not open
* Prefer **explicit failure** over silent recovery
* Preserve **economic safety** over convenience
* Require **manual admin intervention** for irrecoverable edge cases

No automatic rollback of irreversible transitions is permitted.

---

## Review & Immutability

This threat model is **frozen** under:

```
ENCLOSURE-DOCS-V1
```

Any change requires:

* A new protocol version
* A full security review
* Explicit acknowledgment of new risks

---

## Final Note

ENCLOSURE does not promise safety.

It **enforces constraints** such that violating safety becomes harder than complying.

That is the protocol’s security guarantee.
