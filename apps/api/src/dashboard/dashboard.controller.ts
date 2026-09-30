import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { DashboardService } from './dashboard.service.js';
type AuthenticatedRequest = Request & { user: AuthenticatedUser };
@Controller('organizations/:organizationId/dashboard') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get() @RequirePermissions('reconciliation:read')
  summary(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.summary(organizationId, request.user); }
}
