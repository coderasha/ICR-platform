import { Module } from '@nestjs/common'; import { ExceptionsController } from './exceptions.controller.js'; import { ExceptionsService } from './exceptions.service.js'; import { AuditModule } from '../audit/audit.module.js';
@Module({ imports: [AuditModule], controllers: [ExceptionsController], providers: [ExceptionsService] }) export class ExceptionsModule {}
