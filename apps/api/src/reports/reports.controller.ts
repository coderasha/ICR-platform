import { Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { ReportsService } from './reports.service.js';
type AuthenticatedRequest = Request & { user: AuthenticatedUser };
@Controller('organizations/:organizationId/reports') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('exceptions.csv') @RequirePermissions('reports:export')
  async exceptions(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest, @Res() response: Response) {
    const result = await this.service.exceptionsCsv(organizationId, request.user);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8'); response.setHeader('Content-Disposition', `attachment; filename="icr-exceptions-${organizationId}.csv"`); response.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false'); response.send(result.csv);
  }
}
