import { Module } from '@nestjs/common';
import { VirusScanService } from './virus-scan.service';
import { VirusScanWebhookGuard } from './virus-scan-webhook.guard';
import { VirusScanWebhookController } from './virus-scan-webhook.controller';
import { VirusScanStatusJob } from './jobs/virus-scan-status.job';

/**
 * VirusScanModule
 * 
 * Integrates with VirusTotal or similar for async artifact virus scanning.
 * Scan results update artifact.is_infected flag.
 * Scan is async, non-blocking after artifact upload. Timeout after 24 hours.
 */
@Module({
  providers: [VirusScanService, VirusScanWebhookGuard, VirusScanStatusJob],
  controllers: [VirusScanWebhookController],
  exports: [VirusScanService, VirusScanWebhookGuard],
})
export class VirusScanModule {}
