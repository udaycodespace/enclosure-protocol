import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ArtifactDeleteService {
  constructor(
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}
}
