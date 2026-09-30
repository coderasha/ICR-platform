import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { ImportsService } from './imports.service.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const batchId = '33333333-3333-4333-8333-333333333333';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'u@example.com', roles: [], organizationIds: [organizationId], permissions: ['imports:read'] };

describe('ImportsService', () => {
  it('exports rejected rows safely and records evidence without row content', async () => {
    const audit = { record: vi.fn() };
    const prisma = {
      organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) },
      importBatch: { findFirst: vi.fn().mockResolvedValue({ id: batchId, originalFilename: 'jan-close.csv' }) },
      importRow: { findMany: vi.fn().mockResolvedValue([{ rowNumber: 7, errors: '=malicious()', rawData: '@untrusted' }]) },
    };
    const result = await new ImportsService(prisma as unknown as PrismaService, {} as StorageService, audit as unknown as AuditService).rejectedRowsCsv(organizationId, batchId, user);

    expect(result).toMatchObject({ filename: 'jan-close', truncated: false });
    expect(result.csv).toContain('"\'=malicious()"');
    expect(result.csv).toContain('"\'@untrusted"');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'IMPORT_REJECTED_ROWS_EXPORTED', actorUserId: user.id, metadata: { exportedRows: 1, truncated: false, maximumRows: 10_000 } }));
  });

  it('does not disclose batches outside the authorized organization', async () => {
    const prisma = { organization: { findUnique: vi.fn() } };
    const service = new ImportsService(prisma as unknown as PrismaService, {} as StorageService);

    await expect(service.rejectedRowsCsv('44444444-4444-4444-8444-444444444444', batchId, user)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('cancels a queued batch and records the lifecycle transition', async () => {
    const audit = { record: vi.fn() }; const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) }, importBatch: { findFirst: vi.fn().mockResolvedValue({ id: batchId, status: 'QUEUED' }), update: vi.fn().mockResolvedValue({ id: batchId, status: 'CANCELLED' }) } };
    await expect(new ImportsService(prisma as unknown as PrismaService, {} as StorageService, audit as unknown as AuditService).cancelBatch(organizationId, batchId, user)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'IMPORT_BATCH_CANCELLED', before: { status: 'QUEUED' }, after: { status: 'CANCELLED' } }));
  });
});
