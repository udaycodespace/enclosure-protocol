/**
 * RoomValidationStartService
 * Transitions room: IN_PROGRESS → UNDER_VALIDATION
 * Both containers must be sealed before triggering validation.
 * AI has read-only visibility into artifacts for analysis.
 * Transition: ROOM_UNDER_VALIDATION
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { AIService } from '../../ai/ai.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class RoomValidationStartService {
  constructor(
    private readonly auditService: AuditService,
    private readonly aiService: AIService,
    private readonly notificationService: NotificationService,
    // TODO: ContainerModule coordination via module-level DI
  ) {}

  // TODO: Implement room validation start logic (IN_PROGRESS → UNDER_VALIDATION)
}
