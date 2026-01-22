import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIServiceWebhookGuard } from './ai-webhook.guard';
import { AIWebhookController } from './ai-webhook.controller';

/**
 * AIModule
 * 
 * Integrates with AI service (Gemini) for read-only artifact comparison analysis.
 * AI has no mutation capability; output is informational only.
 */
@Module({
  providers: [AIService, AIServiceWebhookGuard],
  controllers: [AIWebhookController],
  exports: [AIService, AIServiceWebhookGuard],
})
export class AIModule {}
