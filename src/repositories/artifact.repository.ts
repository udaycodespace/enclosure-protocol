import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

interface ArtifactEntity {
  id: string;
  container_id: string;
  filename: string;
  content_hash: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  
  // Artifact metadata
  created_at: Date;
  updated_at: Date;
  
  // Virus scanning
  is_scanned: boolean;
  is_infected: boolean;
  scan_result?: string;
}

interface UpdateArtifactPayload {
  filename?: string;
  content_hash?: string;
  file_size?: number;
  mime_type?: string;
  storage_path?: string;
  updated_at?: Date;
  is_scanned?: boolean;
  is_infected?: boolean;
  scan_result?: string;
}

@Injectable()
export class ArtifactRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find artifact by ID (read-only)
   * Atomic: YES (single SELECT)
   * Transaction: NOT required
   */
  async findOne(artifactId: string): Promise<ArtifactEntity | null> {
    const { data, error } = await this.supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifactId)
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Find all artifacts in a container (read-only)
   * Atomic: YES (single SELECT with WHERE)
   * Transaction: NOT required
   */
  async findByContainer(containerId: string): Promise<ArtifactEntity[]> {
    const { data, error } = await this.supabase
      .from('artifacts')
      .select('*')
      .eq('container_id', containerId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Find unscanned artifacts in a container
   * Atomic: YES (single SELECT with WHERE)
   * Transaction: NOT required
   */
  async findUnscannedByContainer(containerId: string): Promise<ArtifactEntity[]> {
    const { data, error } = await this.supabase
      .from('artifacts')
      .select('*')
      .eq('container_id', containerId)
      .eq('is_scanned', false);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Update artifact metadata and scan results
   * Atomic: YES (single UPDATE)
   * Transaction: YES (caller must manage)
   */
  async update(artifactId: string, payload: UpdateArtifactPayload): Promise<ArtifactEntity | null> {
    const updateData: any = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('artifacts')
      .update(updateData)
      .eq('id', artifactId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data || null;
  }

  /**
   * Create new artifact
   * Atomic: YES (single INSERT)
   * Transaction: YES (caller must manage)
   */
  async create(payload: Omit<ArtifactEntity, 'id' | 'created_at' | 'updated_at'>): Promise<ArtifactEntity> {
    const { data, error } = await this.supabase
      .from('artifacts')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Delete artifact by ID
   * Atomic: YES (single DELETE)
   * Transaction: YES (caller must manage)
   */
  async delete(artifactId: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('artifacts')
      .delete()
      .eq('id', artifactId);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Check if artifact exists
   * Atomic: YES (single SELECT COUNT)
   * Transaction: NOT required
   */
  async exists(artifactId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('artifacts')
      .select('id', { count: 'exact' })
      .eq('id', artifactId);

    if (error) {
      throw error;
    }

    return (data?.length || 0) > 0;
  }
}
