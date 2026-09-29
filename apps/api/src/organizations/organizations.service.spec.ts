
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationsService } from './organizations.service.js';

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const organizationId = 'd6d12700-727e-407d-9d06-a38d71bfaa2a';
  const otherOrganizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const prismaMock = {
    organization: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    legalEntity: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  const organization = {
    id: organizationId,
    code: 'ACME',
    name: 'Acme Corporation',
    isActive: true,
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
  };

  const legalEntity = {
    id: '232e5a27-fba7-4e1a-9fbb-acf733499944',
    organizationId,
    code: 'ACME-IN',
    name: 'Acme India Private Limited',
    currencyCode: 'INR',
    isActive: true,
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
  };

  const platformAdmin: AuthenticatedUser = {
    id: 'platform-admin-user',
    email: 'admin@icr.local',
    roles: [{ code: 'PLATFORM_ADMIN', organizationId: null }],
    organizationIds: [],
    permissions: ['organizations:read', 'organizations:manage'],
  };

  const organizationUser: AuthenticatedUser = {
    id: 'organization-user',
    email: 'analyst@icr.local',
    roles: [
      { code: 'RECONCILIATION_ANALYST', organizationId },
    ],
    organizationIds: [organizationId],
    permissions: ['organizations:read'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('createOrganization', () => {
    it('creates an organization with a normalized code and trimmed name for a platform admin', async () => {
      prismaMock.organization.create.mockResolvedValue(organization);

      const result = await service.createOrganization(
        {
          code: ' acme ',
          name: ' Acme Corporation ',
        },
        platformAdmin,
      );

      expect(prismaMock.organization.create).toHaveBeenCalledWith({
        data: {
          code: 'ACME',
          name: 'Acme Corporation',
        },
      });
      expect(result).toEqual(organization);
    });

    it('rejects organization creation by a non-platform administrator', async () => {
      await expect(
        service.createOrganization(
          { code: 'NEWCO', name: 'New Company' },
          organizationUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaMock.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('listOrganizations', () => {
    it('returns all organizations with legal entity counts for a platform admin', async () => {
      const organizations = [
        { ...organization, _count: { legalEntities: 1 } },
      ];

      prismaMock.organization.findMany.mockResolvedValue(organizations);

      await expect(
        service.listOrganizations(platformAdmin),
      ).resolves.toEqual(organizations);

      expect(prismaMock.organization.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { legalEntities: true } } },
      });
    });

    it('limits an organization user to their assigned organizations', async () => {
      prismaMock.organization.findMany.mockResolvedValue([organization]);

      await expect(
        service.listOrganizations(organizationUser),
      ).resolves.toEqual([organization]);

      expect(prismaMock.organization.findMany).toHaveBeenCalledWith({
        where: { id: { in: [organizationId] } },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { legalEntities: true } } },
      });
    });
  });

  describe('getOrganization', () => {
    it('returns an accessible organization and its legal entities', async () => {
      const result = { ...organization, legalEntities: [legalEntity] };
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: organizationId,
      });
      prismaMock.organization.findUnique.mockResolvedValueOnce(result);

      await expect(
        service.getOrganization(organizationId, organizationUser),
      ).resolves.toEqual(result);

      expect(prismaMock.organization.findUnique).toHaveBeenNthCalledWith(
        1,
        {
          where: { id: organizationId },
          select: { id: true },
        },
      );
      expect(prismaMock.organization.findUnique).toHaveBeenNthCalledWith(
        2,
        {
          where: { id: organizationId },
          include: { legalEntities: true },
        },
      );
    });

    it('returns not found when an organization does not exist', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganization(organizationId, organizationUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not allow an organization user to access another organization', async () => {
      await expect(
        service.getOrganization(otherOrganizationId, organizationUser),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateOrganization', () => {
    it('updates an accessible organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: organizationId,
      });
      prismaMock.organization.update.mockResolvedValue({
        ...organization,
        name: 'Acme Global',
      });

      const result = await service.updateOrganization(
        organizationId,
        { name: 'Acme Global' },
        organizationUser,
      );

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: organizationId },
        data: { name: 'Acme Global' },
      });
      expect(result.name).toBe('Acme Global');
    });
  });

  describe('createLegalEntity', () => {
    it('creates a legal entity for an accessible organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: organizationId,
      });
      prismaMock.legalEntity.create.mockResolvedValue(legalEntity);

      const result = await service.createLegalEntity(
        organizationId,
        {
          code: ' acme-in ',
          name: 'Acme India Private Limited',
          currencyCode: 'INR',
        },
        organizationUser,
      );

      expect(prismaMock.legalEntity.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          code: 'ACME-IN',
          name: 'Acme India Private Limited',
          currencyCode: 'INR',
        },
      });
      expect(result).toEqual(legalEntity);
    });

    it('rejects creation when the organization does not exist', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.createLegalEntity(
          organizationId,
          {
            code: 'ACME-IN',
            name: 'Acme India Private Limited',
            currencyCode: 'INR',
          },
          organizationUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.legalEntity.create).not.toHaveBeenCalled();
    });

    it('rejects creation for an organization the user cannot access', async () => {
      await expect(
        service.createLegalEntity(
          otherOrganizationId,
          {
            code: 'OTHER-IN',
            name: 'Other India Private Limited',
          },
          organizationUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.legalEntity.create).not.toHaveBeenCalled();
    });
  });

  describe('listLegalEntities', () => {
    it('returns legal entities scoped to an accessible organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: organizationId,
      });
      prismaMock.legalEntity.findMany.mockResolvedValue([legalEntity]);

      await expect(
        service.listLegalEntities(organizationId, organizationUser),
      ).resolves.toEqual([legalEntity]);

      expect(prismaMock.legalEntity.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getLegalEntity', () => {
    it('looks up a legal entity within an accessible organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: organizationId,
      });
      prismaMock.legalEntity.findFirst.mockResolvedValue(legalEntity);

      await expect(
        service.getLegalEntity(
          organizationId,
          legalEntity.id,
          organizationUser,
        ),
      ).resolves.toEqual(legalEntity);

      expect(prismaMock.legalEntity.findFirst).toHaveBeenCalledWith({
        where: {
          id: legalEntity.id,
          organizationId,
        },
      });
    });

    it('does not disclose a legal entity in an inaccessible organization', async () => {
      await expect(
        service.getLegalEntity(
          otherOrganizationId,
          legalEntity.id,
          organizationUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.legalEntity.findFirst).not.toHaveBeenCalled();
    });

    it('returns not found when the legal entity does not belong to the specified organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: organizationId,
      });
      prismaMock.legalEntity.findFirst.mockResolvedValue(null);

      await expect(
        service.getLegalEntity(
          organizationId,
          legalEntity.id,
          organizationUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});