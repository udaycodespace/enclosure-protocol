import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

interface PaymentEntity {
  id: string;
  room_id: string;
  provider_payment_id: string;
  status: string; // PENDING | CONFIRMED | FAILED | FINAL
  type: string; // ESCROW_HOLD | PAYMENT_CAPTURE | FINAL_BALANCE_RELEASE | REFUND
  amount: number;
  currency: string;
  
  // Payment timing
  created_at: Date;
  updated_at: Date;
  confirmed_at?: Date;
  failed_at?: Date;
  
  // Failure tracking
  failure_reason?: string;
  
  // Payment metadata
  metadata?: string; // JSON-serialized metadata
}

interface UpdatePaymentPayload {
  status?: string;
  type?: string;
  amount?: number;
  updated_at?: Date;
  confirmed_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  metadata?: string;
}

@Injectable()
export class PaymentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find payment by ID (read-only)
   * Atomic: YES (single SELECT)
   * Transaction: NOT required
   */
  async findOne(paymentId: string): Promise<PaymentEntity | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Find payment by provider ID (read-only)
   * Atomic: YES (single SELECT)
   * Transaction: NOT required
   */
  async findByProviderPaymentId(providerPaymentId: string): Promise<PaymentEntity | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('provider_payment_id', providerPaymentId)
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Find all payments for a room (read-only)
   * Atomic: YES (single SELECT with WHERE)
   * Transaction: NOT required
   */
  async findByRoomId(roomId: string): Promise<PaymentEntity[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('room_id', roomId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Find payments by status (read-only)
   * Atomic: YES (single SELECT with WHERE)
   * Transaction: NOT required
   */
  async findByStatus(status: string): Promise<PaymentEntity[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('status', status);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Update payment status and metadata
   * Atomic: YES (single UPDATE)
   * Transaction: YES (caller must manage)
   */
  async update(paymentId: string, payload: UpdatePaymentPayload): Promise<PaymentEntity | null> {
    const updateData: any = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Create new payment
   * Atomic: YES (single INSERT)
   * Transaction: YES (caller must manage)
   */
  async create(payload: Omit<PaymentEntity, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentEntity> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Check if payment exists
   * Atomic: YES (single SELECT COUNT)
   * Transaction: NOT required
   */
  async exists(paymentId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('id', paymentId);

    if (error) {
      throw error;
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Count payments by status for a room
   * Atomic: YES (single SELECT COUNT with WHERE)
   * Transaction: NOT required
   */
  async countByRoomAndStatus(roomId: string, status: string): Promise<number> {
    const { data, error, count } = await this.supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('room_id', roomId)
      .eq('status', status);

    if (error) {
      throw error;
    }

    return count || 0;
  }
}
