import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class ContainerSealService {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}
}
