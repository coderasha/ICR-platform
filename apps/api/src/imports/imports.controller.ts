import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { CreateImportBatchDto, CreateSourceSystemDto, ListImportBatchesDto, ListImportRowsDto, UploadImportDto } from './dto/imports.dto.js';
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
  listBatches(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Query() dto: ListImportBatchesDto, @Req() request: AuthenticatedRequest) { return this.service.listBatches(organizationId, dto, request.user); }
  @Get('imports/:id/rows') @RequirePermissions('imports:read')
  listRows(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Query() dto: ListImportRowsDto, @Req() request: AuthenticatedRequest) { return this.service.listRows(organizationId, id, dto, request.user); }
  @Get('imports/:id/rejected-rows.csv') @RequirePermissions('imports:read')
  async rejectedRowsCsv(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest, @Res() response: Response) { const result = await this.service.rejectedRowsCsv(organizationId, id, request.user); response.setHeader('Content-Type', 'text/csv; charset=utf-8'); response.setHeader('Content-Disposition', `attachment; filename="${result.filename}-rejected-rows.csv"`); response.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false'); response.send(result.csv); }
  @Post('imports') @RequirePermissions('imports:manage')
  createBatch(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateImportBatchDto, @Req() request: AuthenticatedRequest) { return this.service.createBatch(organizationId, dto, request.user); }
  @Post('imports/upload') @RequirePermissions('imports:manage')
  upload(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: UploadImportDto, @Req() request: AuthenticatedRequest) { return this.service.upload(organizationId, dto, request.user); }
  @Post('imports/:id/queue') @RequirePermissions('imports:manage')
  queueBatch(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) { return this.service.queueBatch(organizationId, id, request.user); }
  @Post('imports/:id/cancel') @RequirePermissions('imports:manage')
  cancelBatch(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) { return this.service.cancelBatch(organizationId, id, request.user); }
}
