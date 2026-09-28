import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto.js';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post()
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(dto);
  }

  @Get()
  listOrganizations() {
    return this.organizationsService.listOrganizations();
  }

  @Get(':id')
  getOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.getOrganization(id);
  }

  @Patch(':id')
  updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(id, dto);
  }

  @Post(':organizationId/legal-entities')
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
  listLegalEntities(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.organizationsService.listLegalEntities(organizationId);
  }

  @Get(':organizationId/legal-entities/:id')
  getLegalEntity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizationsService.getLegalEntity(organizationId, id);
  }

  @Patch(':organizationId/legal-entities/:id')
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
