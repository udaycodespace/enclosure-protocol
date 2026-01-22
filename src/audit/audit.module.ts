import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * AuditModule
 * 
 * Provides immutable, append-only audit logging for all state transitions,
 * permission checks, and side effects. Enforced at database level (triggers prevent deletion).
 */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
