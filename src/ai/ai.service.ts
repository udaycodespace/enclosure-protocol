/**
 * AIService
 * 
 * Integrates with AI service (Gemini) for read-only artifact comparison analysis.
 * AI analysis is read-only (no artifact mutations). Analysis result stored in container.validation_details (JSONB).
 * Failure does not roll back room state (isolated error handling). Analysis request ID is idempotency key.
 * 
 * Methods:
 * - requestAnalysis() — submit artifact metadata for analysis (async)
 * - onAnalysisComplete() — webhook callback when analysis finishes (stores result in container.validation_details)
 */
export class AIService {
  constructor() {}

  // TODO: Implement Gemini API integration
  // TODO: Submit artifact metadata for analysis (read-only, no content transfer on first call)
  // TODO: Handle webhook callback for analysis completion
  // TODO: Store analysis result in container.validation_details (JSONB)
  // TODO: Ensure analysis is read-only (no mutations, informational only)
}
