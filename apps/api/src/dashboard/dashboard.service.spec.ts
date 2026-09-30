import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DashboardService } from './dashboard.service.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user', email: 'u@example.com', roles: [], organizationIds: [organizationId], permissions: ['reconciliation:read'] };

describe('DashboardService', () => {
  it('returns summary counts only after tenant scope validation', async () => {
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) }, transaction: { count: vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(9) }, reconciliationException: { count: vi.fn().mockResolvedValue(2) }, reconciliationRun: { count: vi.fn().mockResolvedValue(4) } };
    await expect(new DashboardService(prisma as unknown as PrismaService).summary(organizationId, user)).resolves.toEqual({ transactions: 12, matchedTransactions: 9, openExceptions: 2, completedRuns: 4, closeReadiness: { status: 'BLOCKED', reason: '2 unresolved exceptions remain.' } });
  });
  it('does not disclose a summary outside the authorized organization', async () => {
    const service = new DashboardService({ organization: { findUnique: vi.fn() } } as unknown as PrismaService);
    await expect(service.summary('22222222-2222-4222-8222-222222222222', user)).rejects.toThrow(NotFoundException);
  });
});
