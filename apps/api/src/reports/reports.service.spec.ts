import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { ReportsService } from './reports.service.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'u@example.com', roles: [], organizationIds: [organizationId], permissions: ['reports:export'] };
describe('ReportsService', () => {
  it('escapes CSV values and audits the completed export', async () => {
    const audit = { record: vi.fn() };
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) }, reconciliationException: { findMany: vi.fn().mockResolvedValue([{ id: 'exception-1', exceptionType: 'MISSING_COUNTERPART', severity: 'MEDIUM', status: 'OPEN', currencyCode: 'USD', exposureAmount: { toString: () => '10.250000' }, description: 'Missing "invoice"', createdAt: new Date('2026-01-02T03:04:05.000Z'), legalEntity: { code: 'US01' }, reconciliationRun: { name: 'January close' }, transaction: { documentReference: '=SUM(A1:A2)' } }]) } };
    const result = await new ReportsService(prisma as unknown as PrismaService, audit as unknown as AuditService).exceptionsCsv(organizationId, user);
    expect(result.truncated).toBe(false); expect(result.csv).toContain('"\'=SUM(A1:A2)"'); expect(result.csv).toContain('"Missing ""invoice"""'); expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXCEPTIONS_CSV_EXPORTED', actorUserId: user.id }));
  });
});
