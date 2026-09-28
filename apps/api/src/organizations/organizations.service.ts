import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto.js';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(dto: CreateOrganizationDto) {
    try {
      return await this.prisma.organization.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Organization code already exists');
      }
      throw error;
    }
  }

  async listOrganizations() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { legalEntities: true } },
      },
    });
  }

  async getOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { legalEntities: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    await this.getOrganization(id);

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async createLegalEntity(
    organizationId: string,
    dto: CreateLegalEntityDto,
  ) {
    await this.getOrganization(organizationId);

    try {
      return await this.prisma.legalEntity.create({
        data: {
          organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          currencyCode: dto.currencyCode ?? 'INR',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Legal entity code already exists in this organization',
        );
      }
      throw error;
    }
  }

  async listLegalEntities(organizationId: string) {
    await this.getOrganization(organizationId);

    return this.prisma.legalEntity.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLegalEntity(organizationId: string, id: string) {
    const entity = await this.prisma.legalEntity.findFirst({
      where: { id, organizationId },
    });

    if (!entity) {
      throw new NotFoundException('Legal entity not found');
    }

    return entity;
  }

  async updateLegalEntity(
    organizationId: string,
    id: string,
    dto: UpdateLegalEntityDto,
  ) {
    await this.getLegalEntity(organizationId, id);

    return this.prisma.legalEntity.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.currencyCode !== undefined
          ? { currencyCode: dto.currencyCode }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
