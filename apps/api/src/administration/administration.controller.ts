import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { AssignRoleDto } from './assign-role.dto.js';
import { AdministrationService } from './administration.service.js';
import { UpdateUserActiveDto } from './update-user-active.dto.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('organizations/:organizationId/administration')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdministrationController {
  constructor(private readonly service: AdministrationService) {}

  @Get('users') @RequirePermissions('organizations:manage')
  users(@Param('organizationId', ParseUUIDPipe) org: string, @Req() req: AuthenticatedRequest) { return this.service.users(org, req.user); }

  @Get('roles') @RequirePermissions('organizations:manage')
  roles(@Param('organizationId', ParseUUIDPipe) org: string, @Req() req: AuthenticatedRequest) { return this.service.roles(org, req.user); }

  @Patch('users/:id/active') @RequirePermissions('organizations:manage')
  active(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserActiveDto, @Req() req: AuthenticatedRequest) { return this.service.setActive(org, id, dto.isActive, req.user); }

  @Post('users/:id/roles') @RequirePermissions('organizations:manage')
  assignRole(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleDto, @Req() req: AuthenticatedRequest) { return this.service.assignRole(org, id, dto.roleId, req.user); }

  @Delete('users/:id/roles/:roleId') @RequirePermissions('organizations:manage')
  removeRole(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Param('roleId', ParseUUIDPipe) roleId: string, @Req() req: AuthenticatedRequest) { return this.service.removeRole(org, id, roleId, req.user); }
}
