# ENCLOSURE Protocol

ENCLOSURE is a security-first exchange protocol that enables two anonymous parties
to exchange work, files, and money only when strict, mutually agreed conditions are met.

This repository defines the **authoritative system contracts** for ENCLOSURE:
- Product requirements
- State machines
- Database schema
- Security policies

## What This Repo Is
- A protocol and security baseline
- A source of truth for backend and frontend implementations
- A non-negotiable contract for state transitions and access control

## What This Repo Is NOT
- A UI implementation
- A marketplace
- A chat platform
- A wallet or ledger

## Core Principles
- No trust, only rules
- No partial swaps
- No identity leakage
- No free validation
- No backward state transitions

## Documents
- `docs/ENCLOSURE_PRD_v1.txt` — Product & system definition
- `docs/state-machine.md` — Authoritative state machine
- `backend/database/schema.sql` — Hardened database schema
- `backend/database/policies.sql` — Row Level Security policies

## Status
This repository is currently in **design-locked phase**.
Implementation lives in separate repositories.

## License
Proprietary – All rights reserved.
