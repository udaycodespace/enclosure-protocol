import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { RoomFailureService } from '../../room/services/room-failure.service';

@Injectable()
export class ContainerRejectService {
  constructor(
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => RoomFailureService))
    private readonly roomFailureService: RoomFailureService,
  ) {}
}
