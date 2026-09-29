import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { CreateImportBatchDto, CreateSourceSystemDto } from './dto/imports.dto.js';
import { ImportsService } from './imports.service.js';
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('organizations/:organizationId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly service: ImportsService) {}
  @Get('source-systems') @RequirePermissions('imports:read')
  listSources(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.listSources(organizationId, request.user); }
  @Post('source-systems') @RequirePermissions('imports:manage')
  createSource(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateSourceSystemDto, @Req() request: AuthenticatedRequest) { return this.service.createSource(organizationId, dto, request.user); }
  @Get('imports') @RequirePermissions('imports:read')
  listBatches(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.listBatches(organizationId, request.user); }
  @Post('imports') @RequirePermissions('imports:manage')
  createBatch(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateImportBatchDto, @Req() request: AuthenticatedRequest) { return this.service.createBatch(organizationId, dto, request.user); }
  @Post('imports/:id/queue') @RequirePermissions('imports:manage')
  queueBatch(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) { return this.service.queueBatch(organizationId, id, request.user); }
}
