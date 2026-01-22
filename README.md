# ENCLOSURE Protocol

ENCLOSURE is a security-first exchange protocol that enables two anonymous parties  
to exchange work, files, and money **only when strictly defined conditions are met**.

The protocol is designed to eliminate trust assumptions by enforcing rules at the
database, execution, and state-machine levels.

---

## Purpose

This repository defines the **authoritative system contracts** for ENCLOSURE:

- Product requirements and invariants
- State machines and execution rules
- Database schema and security policies
- Guard and service responsibilities

These documents are **the source of truth** for all implementations.

---

## What This Repository Is

- A protocol specification and security baseline  
- A design-locked reference for backend and frontend implementations  
- A non-negotiable contract for state transitions, permissions, and execution order  

---

## What This Repository Is Not

- A UI or frontend application  
- A marketplace or social platform  
- A chat system  
- A wallet, ledger, or balance tracker  

---

## Core Principles

- Rules over trust  
- Atomic swaps only (no partial execution)  
- Identity separation by default  
- Validation is explicit and paid  
- State is forward-only and irreversible  

---

## Authoritative Documents

- `docs/ENCLOSURE_PRD_v1.txt` — Product and system definition  
- `docs/state-machine.md` — Authoritative state machine  
- `docs/backend-execution-model.md` — Execution & transaction contract  
- `docs/backend-module-structure.md` — Module boundaries & dependencies  
- `docs/backend-skeleton-plan.md` — NestJS file blueprint  
- `backend/database/schema.sql` — Hardened database schema  
- `backend/database/policies.sql` — Row Level Security policies  

---

## Status

This repository is in **design-locked phase**.

All documents are frozen and versioned.  
Implementation occurs in separate repositories and must conform exactly to these contracts.

---

## Architecture Contract

All backend behavior is governed by the frozen documents under `/docs`.

These contracts were finalized and tagged as:

```

ENCLOSURE-DOCS-V1

```

Any backend change **must conform** to these documents.  
Design changes require a new versioned document set and tag.

---

## License

Proprietary — All rights reserved.
