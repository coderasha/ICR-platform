import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
@Module({ imports: [AuditModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
