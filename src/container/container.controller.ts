import { Controller } from '@nestjs/common';
import { ContainerArtifactUploadService } from './services/container-artifact-upload.service';
import { ContainerSealService } from './services/container-seal.service';
import { ContainerValidationStartService } from './services/container-validation-start.service';
import { ContainerApproveService } from './services/container-approve.service';
import { ContainerRejectService } from './services/container-reject.service';
import { ContainerTransferService } from './services/container-transfer.service';
import { ContainerOwnerArtifactUploadGuard } from './guards/container-owner-artifact-upload.guard';
import { ContainerOwnerSealGuard } from './guards/container-owner-seal.guard';
import { SystemContainerValidationStartGuard } from './guards/system-container-validation-start.guard';
import { AdminContainerApproveGuard } from './guards/admin-container-approve.guard';
import { AdminContainerRejectGuard } from './guards/admin-container-reject.guard';
import { SystemContainerTransferGuard } from './guards/system-container-transfer.guard';

@Controller('containers')
export class ContainerController {
  constructor(
    private readonly containerArtifactUploadService: ContainerArtifactUploadService,
    private readonly containerSealService: ContainerSealService,
    private readonly containerValidationStartService: ContainerValidationStartService,
    private readonly containerApproveService: ContainerApproveService,
    private readonly containerRejectService: ContainerRejectService,
    private readonly containerTransferService: ContainerTransferService,
    private readonly containerOwnerArtifactUploadGuard: ContainerOwnerArtifactUploadGuard,
    private readonly containerOwnerSealGuard: ContainerOwnerSealGuard,
    private readonly systemContainerValidationStartGuard: SystemContainerValidationStartGuard,
    private readonly adminContainerApproveGuard: AdminContainerApproveGuard,
    private readonly adminContainerRejectGuard: AdminContainerRejectGuard,
    private readonly systemContainerTransferGuard: SystemContainerTransferGuard,
  ) {}
}
