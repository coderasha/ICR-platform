import { Module } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller.js';
import { ReconciliationService } from './reconciliation.service.js';
import { AuditModule } from '../audit/audit.module.js';
@Module({ imports: [AuditModule], controllers: [ReconciliationController], providers: [ReconciliationService] })
export class ReconciliationModule {}
