import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { VirusScanService } from '../../virus-scan/virus-scan.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ContainerArtifactUploadService {
  constructor(
    private readonly storageService: StorageService,
    private readonly virusScanService: VirusScanService,
    private readonly auditService: AuditService,
  ) {}
}
