/**
 * PaymentService
 * Manages payment aggregate lifecycle and APPEND-ONLY enforcement.
 * Payment records are permanent facts. Only two transitions: PENDING → CONFIRMED or FAILED.
 * Refunds are new payment records (type='REFUND'), never updates to existing records.
 */

import { Injectable } from '@nestjs/common';
import { RazorpayService } from '../../payment-provider/razorpay.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly auditService: AuditService,
  ) {}

  // TODO: Implement payment creation logic
}
