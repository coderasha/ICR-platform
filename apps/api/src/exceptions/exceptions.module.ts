import { Module } from '@nestjs/common'; import { ExceptionsController } from './exceptions.controller.js'; import { ExceptionsService } from './exceptions.service.js';
@Module({ controllers: [ExceptionsController], providers: [ExceptionsService] }) export class ExceptionsModule {}
