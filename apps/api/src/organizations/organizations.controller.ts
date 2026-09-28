
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto.js';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';

@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post()
  @RequirePermissions('organizations:manage')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(dto);
  }

  @Get()
  @RequirePermissions('organizations:read')
  listOrganizations() {
    return this.organizationsService.listOrganizations();
  }

  @Get(':id')
  @RequirePermissions('organizations:read')
  getOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.getOrganization(id);
  }

  @Patch(':id')
  @RequirePermissions('organizations:manage')
  updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(id, dto);
  }

  @Post(':organizationId/legal-entities')
  @RequirePermissions('organizations:manage')
  createLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateLegalEntityDto,
  ) {
    return this.organizationsService.createLegalEntity(
      organizationId,
      dto,
    );
  }

  @Get(':organizationId/legal-entities')
  @RequirePermissions('organizations:read')
  listLegalEntities(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.organizationsService.listLegalEntities(organizationId);
  }

  @Get(':organizationId/legal-entities/:id')
  @RequirePermissions('organizations:read')
  getLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizationsService.getLegalEntity(organizationId, id);
  }

  @Patch(':organizationId/legal-entities/:id')
  @RequirePermissions('organizations:manage')
  updateLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalEntityDto,
  ) {
    return this.organizationsService.updateLegalEntity(
      organizationId,
      id,
      dto,
    );
  }
}