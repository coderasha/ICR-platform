import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TransactionsService } from './transactions.service.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'u@example.com', roles: [], organizationIds: [organizationId], permissions: ['reconciliation:read'] };

describe('TransactionsService', () => {
  it('rejects an inverted transaction date range', async () => {
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) } };
    await expect(new TransactionsService(prisma as unknown as PrismaService).list(organizationId, { page: 1, pageSize: 25, dateFrom: '2026-02-01', dateTo: '2026-01-01' }, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies currency, status, and dates to the organization-scoped query', async () => {
    const findMany = vi.fn().mockResolvedValue([]); const count = vi.fn().mockResolvedValue(0);
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) }, transaction: { findMany, count }, $transaction: vi.fn().mockResolvedValue([[], 0]) };
    await new TransactionsService(prisma as unknown as PrismaService).list(organizationId, { page: 1, pageSize: 25, currencyCode: 'USD', status: 'EXCEPTION', dateFrom: '2026-01-01', dateTo: '2026-01-31' }, user);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId, currencyCode: 'USD', status: 'EXCEPTION', transactionDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) }) }));
  });
});
