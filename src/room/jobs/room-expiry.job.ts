/**
 * RoomExpiryJob
 * Scheduled job running every 5 minutes.
 * Finds expired INVITE_SENT rooms and triggers RoomExpiryService.
 * System operation, runs isolated from user-initiated flows.
 */

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomExpiryService } from '../services/room-expiry.service';

@Injectable()
export class RoomExpiryJob {
  constructor(private readonly roomExpiryService: RoomExpiryService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiry() {
    // TODO: Implement room expiry job (find expired INVITE_SENT rooms, call roomExpiryService)
  }
}
