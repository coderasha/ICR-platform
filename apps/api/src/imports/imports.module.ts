import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';
import { StorageModule } from '../storage/storage.module.js';
@Module({ imports: [StorageModule], controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
