import { Controller, Post, Body } from '@nestjs/common';
import { AIService } from './ai.service';

/**
 * AIWebhookController
 * 
 * Receives analysis result from AI service (Gemini) via webhook.
 * AIAnalysisCompleteWebhook — receives analysis result from AI service.
 * Guard: AIServiceWebhookGuard verifies request ID before processing.
 */
@Controller('webhooks/ai')
export class AIWebhookController {
  constructor(private readonly aiService: AIService) {}

  // TODO: Implement POST /webhooks/ai endpoint
  // TODO: Apply AIServiceWebhookGuard to verify webhook authenticity
  // TODO: Call aiService.onAnalysisComplete() with webhook payload
  // TODO: Ensure analysis result is stored in container.validation_details
  // TODO: Return 200 OK to signal webhook receipt (idempotent)
}
