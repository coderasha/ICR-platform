import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PeriodsService } from './periods.service.js';
const org = '11111111-1111-4111-8111-111111111111'; const user = { id: 'user', email: 'u@example.com', roles: [], organizationIds: [org], permissions: ['reconciliation:execute'] };
describe('PeriodsService', () => {
  it('rejects an inverted period range', async () => { const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: org }) } }; await expect(new PeriodsService(prisma as unknown as PrismaService, {} as AuditService).create(org, { name: 'Jan', periodStart: '2026-01-31', periodEnd: '2026-01-01' }, user)).rejects.toBeInstanceOf(BadRequestException); });
  it('refuses closure with unresolved period exceptions', async () => { const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: org }) }, reconciliationPeriod: { findFirst: vi.fn().mockResolvedValue({ id: 'period', status: 'OPEN', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') }) }, reconciliationRun: { count: vi.fn().mockResolvedValue(1) }, reconciliationException: { count: vi.fn().mockResolvedValue(2) } }; await expect(new PeriodsService(prisma as unknown as PrismaService, {} as AuditService).close(org, 'period', user)).rejects.toBeInstanceOf(BadRequestException); });
});
