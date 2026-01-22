import { Injectable } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AdminContainerRejectGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    throw new Error('TODO');
  }
}
