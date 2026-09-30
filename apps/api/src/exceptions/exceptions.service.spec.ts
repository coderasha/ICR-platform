import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { ExceptionsService } from './exceptions.service.js';
const org = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user', email: 'u@example.com', roles: [], organizationIds: [org], permissions: ['exceptions:resolve'] };
function prisma(status = 'OPEN') { return { organization: { findUnique: vi.fn().mockResolvedValue({ id: org }) }, reconciliationException: { findFirst: vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', status }), update: vi.fn() } }; }
describe('ExceptionsService lifecycle', () => {
  it('does not disclose exceptions outside the user organization', async () => { const service = new ExceptionsService(prisma() as unknown as PrismaService); await expect(service.list('33333333-3333-4333-8333-333333333333', {}, user)).rejects.toThrow(NotFoundException); });
  it('requires approval before resolution', async () => { const service = new ExceptionsService(prisma('PROPOSED') as unknown as PrismaService); await expect(service.update(org, '22222222-2222-4222-8222-222222222222', { status: 'RESOLVED' }, user)).rejects.toThrow(BadRequestException); });
  it('requires explicit approval permission for proposed exceptions', async () => { const service = new ExceptionsService(prisma('PROPOSED') as unknown as PrismaService); await expect(service.update(org, '22222222-2222-4222-8222-222222222222', { status: 'APPROVED' }, user)).rejects.toThrow(ForbiddenException); });
  it('updates a due date with workflow permission and audits the change', async () => {
    const db = prisma() as unknown as { organization: { findUnique: ReturnType<typeof vi.fn> }; reconciliationException: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } }; db.reconciliationException.findFirst.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', status: 'OPEN', assignedToUserId: null, dueAt: null }); db.reconciliationException.update.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', status: 'OPEN', assignedToUserId: null, dueAt: new Date('2026-10-31') }); const audit = { record: vi.fn() };
    await new ExceptionsService(db as unknown as PrismaService, audit as unknown as AuditService).update(org, '22222222-2222-4222-8222-222222222222', { dueAt: '2026-10-31' }, user);
    expect(db.reconciliationException.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dueAt: expect.any(Date) }) })); expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ dueAt: expect.any(String) }) }));
  });
  it('stores evidence under an opaque key and audits metadata only', async () => {
    const db = prisma() as unknown as { organization: { findUnique: ReturnType<typeof vi.fn> }; reconciliationException: { findFirst: ReturnType<typeof vi.fn> }; exceptionAttachment: { create: ReturnType<typeof vi.fn> } };
    db.exceptionAttachment = { create: vi.fn().mockResolvedValue({ id: 'attachment-1', contentType: 'application/pdf', sizeBytes: 4, contentHash: 'a'.repeat(64) }) };
    const audit = { record: vi.fn() }; const storage = { putExceptionEvidence: vi.fn().mockResolvedValue({ key: 'exception-evidence/opaque', size: 4, sha256: 'a'.repeat(64) }), remove: vi.fn() };
    await new ExceptionsService(db as unknown as PrismaService, audit as unknown as AuditService, storage as unknown as StorageService).uploadAttachment(org, '22222222-2222-4222-8222-222222222222', { originalFilename: 'proof final.pdf', contentType: 'application/pdf', contentBase64: 'dGVzdA==' }, user);
    expect(db.exceptionAttachment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ storageKey: 'exception-evidence/opaque', originalFilename: 'proof_final.pdf' }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'RECONCILIATION_EXCEPTION_ATTACHMENT_UPLOADED', metadata: expect.not.objectContaining({ contentBase64: expect.anything() }) }));
  });
});
