import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MasterDataService } from './master-data.service.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const otherOrganizationId = '22222222-2222-4222-822222222222';
const entityId = '33333333-3333-4333-8333-333333333333';
const user = { id: 'user', email: 'user@example.com', roles: [], organizationIds: [organizationId], permissions: ['master_data:manage'] };

function prismaMock() {
  return {
    organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) },
    legalEntity: { findFirst: vi.fn().mockResolvedValue({ id: entityId }) },
    counterparty: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    account: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    intercompanyRelationship: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
}

describe('MasterDataService', () => {
  it('does not disclose master data in an inaccessible organization', async () => {
    const prisma = prismaMock();
    const service = new MasterDataService(prisma as unknown as PrismaService);
    await expect(service.listCounterparties(otherOrganizationId, user)).rejects.toThrow(new NotFoundException('Organization not found'));
    expect(prisma.counterparty.findMany).not.toHaveBeenCalled();
  });

  it('creates a counterparty only after validating its legal entity belongs to the organization', async () => {
    const prisma = prismaMock();
    prisma.counterparty.create.mockResolvedValue({ id: 'counterparty-id' });
    const service = new MasterDataService(prisma as unknown as PrismaService);
    await service.createCounterparty(organizationId, { legalEntityId: entityId, code: 'ic-us', name: 'IC US', countryCode: 'US', currencyCode: 'USD' }, user);
    expect(prisma.legalEntity.findFirst).toHaveBeenCalledWith({ where: { id: entityId, organizationId }, select: { id: true } });
    expect(prisma.counterparty.create).toHaveBeenCalledWith({ data: { organizationId, legalEntityId: entityId, code: 'IC-US', name: 'IC US', countryCode: 'US', currencyCode: 'USD' } });
  });

  it('rejects a self-referencing intercompany relationship', async () => {
    const service = new MasterDataService(prismaMock() as unknown as PrismaService);
    await expect(service.createRelationship(organizationId, { sourceLegalEntityId: entityId, targetLegalEntityId: entityId, name: 'Invalid relationship' }, user)).rejects.toThrow(new BadRequestException('Source and target legal entities must differ'));
  });
});
