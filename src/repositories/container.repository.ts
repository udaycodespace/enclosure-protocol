import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

interface ContainerEntity {
  id: string;
  room_id: string;
  owner_id: string;
  state: string;
  content_hash: string;
  
  // Container metadata
  created_at: Date;
  updated_at: Date;
  
  // Artifact tracking
  artifact_count: number;
  is_scanned: boolean;
  is_infected: boolean;
  
  // Validation tracking
  validation_details?: string;
  validation_summary?: string;
  
  // Sealing & transfer tracking
  sealed_at?: Date;
  transferred_at?: Date;
}

interface UpdateContainerPayload {
  state?: string;
  content_hash?: string;
  updated_at?: Date;
  is_scanned?: boolean;
  is_infected?: boolean;
  validation_details?: string;
  validation_summary?: string;
  sealed_at?: Date;
  transferred_at?: Date;
}

@Injectable()
export class ContainerRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find container by ID (read-only)
   * Atomic: YES (single SELECT)
   * Transaction: NOT required
   */
  async findOne(containerId: string): Promise<ContainerEntity | null> {
    const { data, error } = await this.supabase
      .from('containers')
      .select('*')
      .eq('id', containerId)
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Find all containers for a room (read-only)
   * Atomic: YES (single SELECT with WHERE)
   * Transaction: NOT required
   */
  async findByRoomId(roomId: string): Promise<ContainerEntity[]> {
    const { data, error } = await this.supabase
      .from('containers')
      .select('*')
      .eq('room_id', roomId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Find all containers for a specific owner (read-only)
   * Atomic: YES (single SELECT with WHERE)
   * Transaction: NOT required
   */
  async findByOwnerId(ownerId: string): Promise<ContainerEntity[]> {
    const { data, error } = await this.supabase
      .from('containers')
      .select('*')
      .eq('owner_id', ownerId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Update container state and metadata
   * Atomic: YES (single UPDATE)
   * Transaction: YES (caller must manage)
   */
  async update(containerId: string, payload: UpdateContainerPayload): Promise<ContainerEntity | null> {
    const updateData: any = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('containers')
      .update(updateData)
      .eq('id', containerId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Create new container
   * Atomic: YES (single INSERT)
   * Transaction: YES (caller must manage)
   */
  async create(payload: Omit<ContainerEntity, 'id' | 'created_at' | 'updated_at'>): Promise<ContainerEntity> {
    const { data, error } = await this.supabase
      .from('containers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Check if container exists
   * Atomic: YES (single SELECT COUNT)
   * Transaction: NOT required
   */
  async exists(containerId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('containers')
      .select('id', { count: 'exact' })
      .eq('id', containerId);

    if (error) {
      throw error;
    }

    return (data?.length || 0) > 0;
  }
}
