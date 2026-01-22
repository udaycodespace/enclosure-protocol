import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { ContainerModule } from '../container/container.module';
import { ArtifactController } from './artifact.controller';
import { ArtifactCreateService } from './services/artifact-create.service';
import { ArtifactDeleteService } from './services/artifact-delete.service';
import { ArtifactViewService } from './services/artifact-view.service';
import { ContainerOwnerArtifactCreateGuard } from './guards/container-owner-artifact-create.guard';
import { ContainerOwnerArtifactDeleteGuard } from './guards/container-owner-artifact-delete.guard';
import { ArtifactAccessGuard } from './guards/artifact-access.guard';

@Module({
  imports: [AuditModule, StorageModule, ContainerModule],
  controllers: [ArtifactController],
  providers: [
    ArtifactCreateService,
    ArtifactDeleteService,
    ArtifactViewService,
    ContainerOwnerArtifactCreateGuard,
    ContainerOwnerArtifactDeleteGuard,
    ArtifactAccessGuard,
  ],
  exports: [ArtifactCreateService, ArtifactDeleteService, ArtifactViewService],
})
export class ArtifactModule {}
