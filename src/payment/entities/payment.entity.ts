/**
 * Payment Entity
 * Represents a payment record (APPEND-ONLY, immutable).
 * Payment transitions: PENDING → CONFIRMED or FAILED (only two transitions).
 * Refunds are new payment records (type='REFUND'), never updates to existing records.
 */

export class Payment {
  // TODO: Add entity properties and field definitions
}
