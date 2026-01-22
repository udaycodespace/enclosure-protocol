import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';
import { StorageModule } from './storage/storage.module';
import { PaymentProviderModule } from './payment-provider/payment-provider.module';
import { AIModule } from './ai/ai.module';
import { VirusScanModule } from './virus-scan/virus-scan.module';

import { PaymentModule } from './payment/payment.module';
import { RoomModule } from './room/room.module';
import { ContainerModule } from './container/container.module';
import { ArtifactModule } from './artifact/artifact.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),

    // Infrastructure
    AuditModule,
    NotificationModule,
    StorageModule,
    PaymentProviderModule,
    AIModule,
    VirusScanModule,

    // Domain
    PaymentModule,
    RoomModule,
    ContainerModule,
    ArtifactModule,
  ],
})
export class AppModule {}
