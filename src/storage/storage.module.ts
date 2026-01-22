import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * StorageModule
 * 
 * Manages file operations with Supabase Storage (upload, download, delete, move).
 * Operations are async; orphaned files acceptable (cleanup job handles).
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
