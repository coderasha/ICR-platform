import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto.js';
import { ReconciliationService } from './reconciliation.service.js';
import { ListReconciliationRunsDto } from './dto/list-reconciliation-runs.dto.js';
type AuthenticatedRequest = Request & { user: AuthenticatedUser };
@Controller('organizations/:organizationId/reconciliation-runs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}
  @Get() @RequirePermissions('reconciliation:read')
  list(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Query() dto: ListReconciliationRunsDto, @Req() request: AuthenticatedRequest) { return this.service.list(organizationId, dto, request.user); }
  @Get(':id') @RequirePermissions('reconciliation:read')
  detail(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) { return this.service.detail(organizationId, id, request.user); }
  @Post() @RequirePermissions('reconciliation:execute')
  create(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateReconciliationRunDto, @Req() request: AuthenticatedRequest) { return this.service.create(organizationId, dto, request.user); }
  @Post(':id/queue') @RequirePermissions('reconciliation:execute')
  queue(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) { return this.service.queueRun(organizationId, id, request.user); }
  @Post(':id/cancel') @RequirePermissions('reconciliation:execute')
  cancel(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) { return this.service.cancelRun(organizationId, id, request.user); }
}
