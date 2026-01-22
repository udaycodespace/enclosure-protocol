# ENCLOSURE Protocol

ENCLOSURE is a **security-first exchange protocol** that enables two anonymous parties
to exchange work, files, and money **only when strictly defined conditions are met**.

The protocol deliberately removes human trust from the equation and replaces it with
**immutable rules**, enforced across the database, execution layer, and state machines.

ENCLOSURE does not “facilitate trust.”
It **eliminates the need for it**.

---

## Purpose

This repository defines the **authoritative system contracts** for ENCLOSURE.

It is the single source of truth for:

* Product requirements and invariants
* State machines and irreversible transitions
* Execution order, transaction boundaries, and idempotency rules
* Database schema, Row Level Security (RLS), and access guarantees
* Guard and service responsibilities

Every implementation of ENCLOSURE **must conform to these documents exactly**.

---

## What This Repository *Is*

* A **protocol specification**, not an application
* A **security baseline** for all future implementations
* A **design-locked reference** for backend and frontend systems
* A **non-negotiable contract** for state, permissions, and execution

This repository defines *what is allowed to exist* in an ENCLOSURE system.

---

## What This Repository *Is Not*

* A UI or frontend application
* A marketplace or discovery platform
* A chat or messaging system
* A wallet, ledger, or balance tracker

Anything resembling the above lives **outside** this repository and must obey it.

---

## Core Principles

* **Rules over trust** — no human promises, only enforced invariants
* **Atomic swaps only** — partial execution is impossible
* **Identity separation by default** — parties never see each other
* **Validation is explicit and paid** — no free or silent verification
* **Forward-only state** — no rollback, no rewrites, no erasure

Violating any principle is considered a **critical protocol defect**.

---

## Authoritative Documents

The following documents are **frozen contracts**:

* `docs/ENCLOSURE_PRD_v1.txt` — Product and system definition
* `docs/state-machine.md` — Authoritative state machine
* `docs/backend-execution-model.md` — Execution & transaction contract
* `docs/backend-module-structure.md` — Module boundaries & dependencies
* `docs/backend-skeleton-plan.md` — NestJS file blueprint
* `backend/database/schema.sql` — Hardened database schema
* `backend/database/policies.sql` — Row Level Security (RLS) policies

No implementation may diverge from these without a new protocol version.

---

## Status

This repository is in **DESIGN-LOCKED** state.

* All documents are finalized
* All contracts are immutable
* All rules are enforceable

Implementation occurs in **separate repositories** and must strictly comply with this one.

---

## Architecture Contract

All backend behavior is governed by the frozen documents under `/docs`.

These contracts were finalized, reviewed, and tagged as:

```
ENCLOSURE-DOCS-V1
```

Any backend or frontend change **must conform** to these documents.

Design changes are **not allowed** without:

1. A new versioned document set
2. A new immutable tag
3. Explicit acknowledgment of breaking changes

---

## Implementation Rules

The following rules are absolute:

* No business logic outside services
* No state changes in controllers
* No bypassing guards
* No direct database writes outside repositories
* No backward state transitions
* No silent reads (all access is auditable)

Breaking these rules invalidates the implementation.

---

## License

**Proprietary — All rights reserved**

ENCLOSURE is not an open playground.
It is a protocol with consequences.
