
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationsService } from './organizations.service.js';

describe('OrganizationsService', () => {
  let service: OrganizationsService;

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
    id: 'd6d12700-727e-407d-9d06-a38d71bfaa2a',
    code: 'ACME',
    name: 'Acme Corporation',
    isActive: true,
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
  };

  const legalEntity = {
    id: '232e5a27-fba7-4e1a-9fbb-acf733499944',
    organizationId: organization.id,
    code: 'ACME-IN',
    name: 'Acme India Private Limited',
    currencyCode: 'INR',
    isActive: true,
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
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
    it('creates an organization with a normalized code and trimmed name', async () => {
      prismaMock.organization.create.mockResolvedValue(organization);

      const result = await service.createOrganization({
        code: ' acme ',
        name: ' Acme Corporation ',
      });

      expect(prismaMock.organization.create).toHaveBeenCalledWith({
        data: {
          code: 'ACME',
          name: 'Acme Corporation',
        },
      });
      expect(result).toEqual(organization);
    });
  });

  describe('listOrganizations', () => {
    it('returns organizations with legal entity counts', async () => {
      const organizations = [
        { ...organization, _count: { legalEntities: 1 } },
      ];

      prismaMock.organization.findMany.mockResolvedValue(organizations);

      await expect(service.listOrganizations()).resolves.toEqual(organizations);

      expect(prismaMock.organization.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { legalEntities: true } } },
      });
    });
  });

  describe('getOrganization', () => {
    it('returns an organization and its legal entities', async () => {
      const result = { ...organization, legalEntities: [legalEntity] };
      prismaMock.organization.findUnique.mockResolvedValue(result);

      await expect(service.getOrganization(organization.id)).resolves.toEqual(
        result,
      );

      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
        where: { id: organization.id },
        include: { legalEntities: true },
      });
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganization(organization.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateOrganization', () => {
    it('updates an existing organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(organization);
      prismaMock.organization.update.mockResolvedValue({
        ...organization,
        name: 'Acme Global',
      });

      const result = await service.updateOrganization(organization.id, {
        name: 'Acme Global',
      });

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: organization.id },
        data: { name: 'Acme Global' },
      });
      expect(result.name).toBe('Acme Global');
    });
  });

  describe('createLegalEntity', () => {
    it('creates a legal entity for an existing organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(organization);
      prismaMock.legalEntity.create.mockResolvedValue(legalEntity);

      const result = await service.createLegalEntity(organization.id, {
        code: ' acme-in ',
        name: 'Acme India Private Limited',
        currencyCode: 'INR',
      });

      expect(prismaMock.legalEntity.create).toHaveBeenCalledWith({
        data: {
          organizationId: organization.id,
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
        service.createLegalEntity(organization.id, {
          code: 'ACME-IN',
          name: 'Acme India Private Limited',
          currencyCode: 'INR',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.legalEntity.create).not.toHaveBeenCalled();
    });
  });

  describe('listLegalEntities', () => {
    it('returns legal entities scoped to the specified organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(organization);
      prismaMock.legalEntity.findMany.mockResolvedValue([legalEntity]);

      await expect(
        service.listLegalEntities(organization.id),
      ).resolves.toEqual([legalEntity]);

      expect(prismaMock.legalEntity.findMany).toHaveBeenCalledWith({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getLegalEntity', () => {
    it('looks up a legal entity within its organization', async () => {
      prismaMock.legalEntity.findFirst.mockResolvedValue(legalEntity);

      await expect(
        service.getLegalEntity(organization.id, legalEntity.id),
      ).resolves.toEqual(legalEntity);

      expect(prismaMock.legalEntity.findFirst).toHaveBeenCalledWith({
        where: {
          id: legalEntity.id,
          organizationId: organization.id,
        },
      });
    });

    it('does not return a legal entity belonging to another organization', async () => {
      prismaMock.legalEntity.findFirst.mockResolvedValue(null);

      await expect(
        service.getLegalEntity(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          legalEntity.id,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.legalEntity.findFirst).toHaveBeenCalledWith({
        where: {
          id: legalEntity.id,
          organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      });
    });
  });
});
