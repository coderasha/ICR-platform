import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { ReconciliationModule } from './reconciliation/reconciliation.module.js';
import { HealthModule } from './health/health.module.js';
import { StorageModule } from './storage/storage.module.js';
import { ExceptionsModule } from './exceptions/exceptions.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { AuditModule } from './audit/audit.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
    imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    MasterDataModule,
    ImportsModule,
    ReconciliationModule,
    HealthModule,
    StorageModule,
    ExceptionsModule,
    TransactionsModule,
    AuditModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
