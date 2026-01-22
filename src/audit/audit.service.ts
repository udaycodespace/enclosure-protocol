/**
 * AuditService
 * 
 * Provides immutable, append-only audit logging for all state transitions,
 * permission checks, and side effects. All mutations must be logged before and after execution.
 * 
 * Methods:
 * - logAttempt() — log guard permission check before execution
 * - logResult() — log guard result (allowed/denied)
 * - logTransition() — log service state change (prev → next)
 * - logSideEffect() — log individual side effects (payment confirmed, artifact moved, etc.)
 * - logFailure() — log failed transition with reason
 * - checkIdempotency() — query recent audit log to detect duplicates
 */
export class AuditService {
  constructor() {}

  // TODO: Implement audit logging methods
  // TODO: Connect to database via TypeORM/Prisma
}
