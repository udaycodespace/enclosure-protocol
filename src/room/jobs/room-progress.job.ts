/**
 * RoomProgressJob
 * Scheduled job running every 1 minute.
 * Finds LOCKED rooms with all payments confirmed and triggers RoomProgressService.
 * System operation, runs isolated from user-initiated flows.
 */

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomProgressService } from '../services/room-progress.service';

@Injectable()
export class RoomProgressJob {
  constructor(private readonly roomProgressService: RoomProgressService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleProgress() {
    // TODO: Implement room progress job (find LOCKED rooms with all payments confirmed, call roomProgressService)
  }
}
