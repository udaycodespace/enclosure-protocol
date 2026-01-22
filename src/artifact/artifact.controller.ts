import { Controller } from '@nestjs/common';
import { ArtifactCreateService } from './services/artifact-create.service';
import { ArtifactDeleteService } from './services/artifact-delete.service';
import { ArtifactViewService } from './services/artifact-view.service';
import { ContainerOwnerArtifactCreateGuard } from './guards/container-owner-artifact-create.guard';
import { ContainerOwnerArtifactDeleteGuard } from './guards/container-owner-artifact-delete.guard';
import { ArtifactAccessGuard } from './guards/artifact-access.guard';

@Controller('artifacts')
export class ArtifactController {
  constructor(
    private readonly artifactCreateService: ArtifactCreateService,
    private readonly artifactDeleteService: ArtifactDeleteService,
    private readonly artifactViewService: ArtifactViewService,
    private readonly containerOwnerArtifactCreateGuard: ContainerOwnerArtifactCreateGuard,
    private readonly containerOwnerArtifactDeleteGuard: ContainerOwnerArtifactDeleteGuard,
    private readonly artifactAccessGuard: ArtifactAccessGuard,
  ) {}
}
