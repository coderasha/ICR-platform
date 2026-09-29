import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'; import { PermissionsGuard } from '../auth/permissions.guard.js'; import { RequirePermissions } from '../auth/require-permissions.decorator.js'; import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { UpdateExceptionDto } from './dto/update-exception.dto.js'; import { ExceptionsService } from './exceptions.service.js';
type AuthenticatedRequest = Request & { user: AuthenticatedUser };
@Controller('organizations/:organizationId/exceptions') @UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExceptionsController { constructor(private readonly service: ExceptionsService) {} @Get() @RequirePermissions('exceptions:read') list(@Param('organizationId', ParseUUIDPipe) org: string, @Req() req: AuthenticatedRequest) { return this.service.list(org, req.user); } @Patch(':id') @RequirePermissions('exceptions:resolve') update(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExceptionDto, @Req() req: AuthenticatedRequest) { return this.service.update(org, id, dto, req.user); } }
