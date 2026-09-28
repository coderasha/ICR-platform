
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto.js';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private isPlatformAdmin(user: AuthenticatedUser): boolean {
    return user.roles.some(
      (role) =>
        role.code === 'PLATFORM_ADMIN' &&
        role.organizationId === null,
    );
  }

  private hasOrganizationAccess(
    user: AuthenticatedUser,
    organizationId: string,
  ): boolean {
    return (
      this.isPlatformAdmin(user) ||
      user.organizationIds.includes(organizationId)
    );
  }

  private assertPlatformAdmin(user: AuthenticatedUser): void {
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Platform administrator access is required',
      );
    }
  }

  private async assertOrganizationAccess(
    organizationId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!this.hasOrganizationAccess(user, organizationId)) {
      // Do not disclose whether an inaccessible organization exists.
      throw new NotFoundException('Organization not found');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  async createOrganization(
    dto: CreateOrganizationDto,
    user: AuthenticatedUser,
  ) {
    this.assertPlatformAdmin(user);

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

  async listOrganizations(user: AuthenticatedUser) {
    const where: Prisma.OrganizationWhereInput =
      this.isPlatformAdmin(user)
        ? {}
        : { id: { in: user.organizationIds } };

    return this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { legalEntities: true } },
      },
    });
  }

  async getOrganization(
    id: string,
    user: AuthenticatedUser,
  ) {
    await this.assertOrganizationAccess(id, user);

    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { legalEntities: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    user: AuthenticatedUser,
  ) {
    await this.assertOrganizationAccess(id, user);

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
    user: AuthenticatedUser,
  ) {
    await this.assertOrganizationAccess(organizationId, user);

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

  async listLegalEntities(
    organizationId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertOrganizationAccess(organizationId, user);

    return this.prisma.legalEntity.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLegalEntity(
    organizationId: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    await this.assertOrganizationAccess(organizationId, user);

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
    user: AuthenticatedUser,
  ) {
    await this.assertOrganizationAccess(organizationId, user);

    const entity = await this.getLegalEntity(
      organizationId,
      id,
      user,
    );

    return this.prisma.legalEntity.update({
      where: { id: entity.id },
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