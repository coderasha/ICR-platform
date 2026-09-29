import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { MasterDataService } from './master-data.service.js';
import { CreateAccountDto, CreateCounterpartyDto, CreateIntercompanyRelationshipDto, UpdateAccountDto, UpdateCounterpartyDto, UpdateIntercompanyRelationshipDto } from './dto/master-data.dto.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('organizations/:organizationId/master-data')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get('counterparties') @RequirePermissions('master_data:read')
  listCounterparties(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.listCounterparties(organizationId, request.user); }
  @Post('counterparties') @RequirePermissions('master_data:manage')
  createCounterparty(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateCounterpartyDto, @Req() request: AuthenticatedRequest) { return this.service.createCounterparty(organizationId, dto, request.user); }
  @Patch('counterparties/:id') @RequirePermissions('master_data:manage')
  updateCounterparty(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCounterpartyDto, @Req() request: AuthenticatedRequest) { return this.service.updateCounterparty(organizationId, id, dto, request.user); }

  @Get('accounts') @RequirePermissions('master_data:read')
  listAccounts(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.listAccounts(organizationId, request.user); }
  @Post('accounts') @RequirePermissions('master_data:manage')
  createAccount(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateAccountDto, @Req() request: AuthenticatedRequest) { return this.service.createAccount(organizationId, dto, request.user); }
  @Patch('accounts/:id') @RequirePermissions('master_data:manage')
  updateAccount(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto, @Req() request: AuthenticatedRequest) { return this.service.updateAccount(organizationId, id, dto, request.user); }

  @Get('relationships') @RequirePermissions('master_data:read')
  listRelationships(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Req() request: AuthenticatedRequest) { return this.service.listRelationships(organizationId, request.user); }
  @Post('relationships') @RequirePermissions('master_data:manage')
  createRelationship(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateIntercompanyRelationshipDto, @Req() request: AuthenticatedRequest) { return this.service.createRelationship(organizationId, dto, request.user); }
  @Patch('relationships/:id') @RequirePermissions('master_data:manage')
  updateRelationship(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIntercompanyRelationshipDto, @Req() request: AuthenticatedRequest) { return this.service.updateRelationship(organizationId, id, dto, request.user); }
}
