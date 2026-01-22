import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ContainerTransferService {
  constructor(private readonly auditService: AuditService) {}
}
