import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller.js';
import { MasterDataService } from './master-data.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({ imports: [AuditModule], controllers: [MasterDataController], providers: [MasterDataService] })
export class MasterDataModule {}
