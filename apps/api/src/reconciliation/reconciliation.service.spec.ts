import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReconciliationService } from './reconciliation.service.js';
const org = '11111111-1111-4111-8111-111111111111'; const user = { id: 'user', email: 'u@example.com', roles: [], organizationIds: [org], permissions: ['reconciliation:execute'] };
describe('ReconciliationService periods', () => {
  it('rejects a new run that overlaps a closed reconciliation period', async () => { const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: org }) }, reconciliationPeriod: { findFirst: vi.fn().mockResolvedValue({ name: 'January close' }) } }; await expect(new ReconciliationService(prisma as unknown as PrismaService).create(org, { name: 'Retry', legalEntityId: '22222222-2222-4222-8222-222222222222', counterpartLegalEntityId: '33333333-3333-4333-8333-333333333333', periodStart: '2026-01-01', periodEnd: '2026-01-31', rulesVersion: 'exact-reference-v1' }, user)).rejects.toBeInstanceOf(BadRequestException); });
});
