/**
 * SwapExecutionJob
 * Scheduled job running every 2 minutes.
 * Finds SWAP_READY rooms and retries AtomicSwapExecutionService (max 3 attempts).
 * System operation, runs isolated from user-initiated flows.
 */

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AtomicSwapExecutionService } from '../services/atomic-swap-execution.service';

@Injectable()
export class SwapExecutionJob {
  constructor(private readonly atomicSwapExecutionService: AtomicSwapExecutionService) {}

  @Cron('0 */2 * * * *')
  async handleSwapExecution() {
    // TODO: Implement swap execution job (find SWAP_READY rooms, retry atomicSwapExecutionService with max 3 attempts)
  }
}
