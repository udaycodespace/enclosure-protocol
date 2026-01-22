import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

interface RoomEntity {
  id: string;
  state: string;
  creator_id: string;
  counterparty_id?: string;
  room_type: string;
  required_amount: number;
  requirements_hash: string;
  
  // Room state timestamps
  created_at: Date;
  updated_at: Date;
  invite_sent_at?: Date;
  joined_at?: Date;
  locked_at?: Date;
  in_progress_at?: Date;
  under_validation_at?: Date;
  swap_ready_at?: Date;
  swapped_at?: Date;
  failed_at?: Date;
  expired_at?: Date;
  
  // Approval/Failure tracking
  approved_by?: string;
  approval_reason?: string;
  approved_at?: Date;
  
  failure_reason?: string;
  
  // Swap readiness
  swap_ready_timestamp?: Date;
}

interface UpdateRoomPayload {
  state?: string;
  counterparty_id?: string;
  created_at?: Date;
  updated_at?: Date;
  invite_sent_at?: Date;
  joined_at?: Date;
  locked_at?: Date;
  in_progress_at?: Date;
  under_validation_at?: Date;
  swap_ready_at?: Date;
  swapped_at?: Date;
  failed_at?: Date;
  expired_at?: Date;
  approved_by?: string;
  approval_reason?: string;
  approved_at?: Date;
  failure_reason?: string;
}

@Injectable()
export class RoomRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find room by ID (read-only)
   * Atomic: YES (single SELECT)
   * Transaction: NOT required
   */
  async findOne(roomId: string): Promise<RoomEntity | null> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Update room state and metadata
   * Atomic: YES (single UPDATE)
   * Transaction: YES (caller must manage)
   */
  async update(roomId: string, payload: UpdateRoomPayload): Promise<RoomEntity | null> {
    const updateData: any = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Check if room exists (for validation only)
   * Atomic: YES (single SELECT COUNT)
   * Transaction: NOT required
   */
  async exists(roomId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('id', { count: 'exact' })
      .eq('id', roomId);

    if (error) {
      throw error;
    }

    return (data?.length || 0) > 0;
  }
}
