
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto.js';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post()
  @RequirePermissions('organizations:manage')
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.createOrganization(
      dto,
      request.user,
    );
  }

  @Get()
  @RequirePermissions('organizations:read')
  listOrganizations(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.listOrganizations(request.user);
  }

  @Get(':id')
  @RequirePermissions('organizations:read')
  getOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.getOrganization(
      id,
      request.user,
    );
  }

  @Patch(':id')
  @RequirePermissions('organizations:manage')
  updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.updateOrganization(
      id,
      dto,
      request.user,
    );
  }

  @Post(':organizationId/legal-entities')
  @RequirePermissions('organizations:manage')
  createLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateLegalEntityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.createLegalEntity(
      organizationId,
      dto,
      request.user,
    );
  }

  @Get(':organizationId/legal-entities')
  @RequirePermissions('organizations:read')
  listLegalEntities(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.listLegalEntities(
      organizationId,
      request.user,
    );
  }

  @Get(':organizationId/legal-entities/:id')
  @RequirePermissions('organizations:read')
  getLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.getLegalEntity(
      organizationId,
      id,
      request.user,
    );
  }

  @Patch(':organizationId/legal-entities/:id')
  @RequirePermissions('organizations:manage')
  updateLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalEntityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.updateLegalEntity(
      organizationId,
      id,
      dto,
      request.user,
    );
  }
}