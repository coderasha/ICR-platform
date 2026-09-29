import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { AuditService } from './audit.service.js';
type AuthenticatedRequest = Request & { user: AuthenticatedUser };
@Controller('organizations/:organizationId/audit-events') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() @RequirePermissions('audit:read')
  list(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.list(organizationId, request.user); }
}
