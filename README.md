# ENCLOSURE Protocol

ENCLOSURE is a **security-first exchange protocol** that enables two anonymous parties to exchange work, files, and money **only when cryptographically and procedurally irreversible conditions are satisfied**.

Human trust is not assumed.
Human discretion is not required.

ENCLOSURE replaces promises, reputation, and intent with **immutable rules**, enforced across:

* Database constraints
* Guarded execution layers
* Forward-only state machines

ENCLOSURE does not facilitate trust.
It **removes the need for it entirely**.

---

## Purpose

This repository defines the **authoritative protocol contract** for ENCLOSURE.

It is the **single source of truth** for:

* Product invariants and non-negotiable rules
* State machines and irreversible transitions
* Execution order, transaction boundaries, and sagas
* Guard vs service responsibilities
* Database schema, Row Level Security (RLS), and immutability guarantees

Any system claiming to be “ENCLOSURE-compatible” **must conform to this repository exactly**.

Deviation is not an implementation choice — it is a protocol violation.

---

## What This Repository **Is**

* A **protocol specification**, not an application
* A **security baseline**, not a feature roadmap
* A **design-locked contract**, not an evolving draft
* A **hard boundary** for backend and frontend behavior

This repository defines **what is allowed to exist** in an ENCLOSURE system —
and, more importantly, **what is permanently forbidden**.

---

## What This Repository **Is Not**

* A UI or frontend application
* A marketplace or discovery layer
* A messaging or negotiation channel
* A wallet, ledger, or balance manager

All of the above may exist elsewhere.
None of them may violate what is defined here.

---

## Core Principles (Non-Negotiable)

* **Rules over trust** — no human promises, only enforced invariants
* **Atomic execution only** — partial completion is impossible
* **Identity separation by default** — parties never see each other
* **Validation is explicit and paid** — nothing is free or silent
* **Forward-only state** — no rollback, no rewrite, no erasure

Violating any principle is considered a **critical protocol defect**.

---

## Authoritative Documents

The following documents are **frozen contracts**:

* `docs/ENCLOSURE_PRD_v1.txt` — Product & system definition
* `docs/state-machine.md` — Authoritative state machine
* `docs/backend-execution-model.md` — Execution & transaction contract
* `docs/backend-module-structure.md` — Module boundaries & dependencies
* `docs/backend-skeleton-plan.md` — NestJS file blueprint
* `backend/database/schema.sql` — Hardened database schema
* `backend/database/policies.sql` — Row Level Security (RLS) policies
* `IMPLEMENTATION_STATUS.md` — Auditor-ready implementation freeze

No implementation may diverge from these without a **new protocol version and re-audit**.

---

## Status

🔒 **DESIGN & SPECIFICATION LOCKED — Protocol v2.0**

* All transitions defined
* All invariants specified
* All guard structures scaffolded
* All mutation boundaries explicit
* All unsafe execution paths blocked by design

This repository is **complete at the protocol level**.

Implementation is intentionally gated and must occur in **separate repositories**.

---

## Architecture Contract

All backend behavior is governed by the frozen documents under `/docs`.

This protocol is versioned and sealed as:

```
ENCLOSURE-PROTOCOL-V2.0
```

Any backend or frontend system must conform **exactly**.

Design changes are **not allowed** without:

1. A new versioned document set
2. A new immutable git tag
3. Explicit acknowledgment of breaking changes
4. A full security re-audit

---

## Implementation Rules (Absolute)

* No business logic outside services
* No state changes in controllers
* No bypassing guards
* No mutations inside guards
* No direct database writes outside repositories
* No backward state transitions
* No silent reads — all access is auditable

Breaking any rule invalidates the implementation.

---

## Optional Future Enhancements (Non-Design)

These are **intentionally optional**.
They are not required to consider the protocol complete.

Only pursue these when implementation begins.

### If proceeding with engineering:

* Create a **Guard Implementation Work Plan** (by guard, by section)
* Generate a **Service Mutation Execution Checklist**
* Prepare a **Production-Readiness Gate Document**

### If stopping here:

* Tag the repository (`ENCLOSURE-PROTOCOL-V2.0`)
* Treat this repo as immutable reference
* Walk away

Both paths are valid.

---

## License

**Proprietary — All rights reserved**

ENCLOSURE is not an open playground.
It is a protocol with consequences.
