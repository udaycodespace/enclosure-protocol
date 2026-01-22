import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../storage/storage.module';
import { VirusScanModule } from '../virus-scan/virus-scan.module';
import { RoomModule } from '../room/room.module';
import { ContainerController } from './container.controller';
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

@Module({
  imports: [
    AuditModule,
    NotificationModule,
    StorageModule,
    VirusScanModule,
    forwardRef(() => RoomModule),
  ],
  controllers: [ContainerController],
  providers: [
    ContainerArtifactUploadService,
    ContainerSealService,
    ContainerValidationStartService,
    ContainerApproveService,
    ContainerRejectService,
    ContainerTransferService,
    ContainerOwnerArtifactUploadGuard,
    ContainerOwnerSealGuard,
    SystemContainerValidationStartGuard,
    AdminContainerApproveGuard,
    AdminContainerRejectGuard,
    SystemContainerTransferGuard,
  ],
  exports: [
    ContainerArtifactUploadService,
    ContainerSealService,
    ContainerValidationStartService,
    ContainerApproveService,
    ContainerRejectService,
    ContainerTransferService,
  ],
})
export class ContainerModule {}
