import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ContainerValidationStartService {
  constructor(private readonly auditService: AuditService) {}
}
