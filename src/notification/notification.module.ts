import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';

/**
 * NotificationModule
 * 
 * Handles asynchronous, non-blocking notifications (email, SMS, in-app).
 * Failures do not roll back transactions. Retry logic: exponential backoff, max 3 attempts per notification.
 */
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
