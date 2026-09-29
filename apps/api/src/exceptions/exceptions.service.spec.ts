import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ExceptionsService } from './exceptions.service.js';
const org = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user', email: 'u@example.com', roles: [], organizationIds: [org], permissions: ['exceptions:resolve'] };
function prisma(status = 'OPEN') { return { organization: { findUnique: vi.fn().mockResolvedValue({ id: org }) }, reconciliationException: { findFirst: vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', status }), update: vi.fn() } }; }
describe('ExceptionsService lifecycle', () => {
  it('does not disclose exceptions outside the user organization', async () => { const service = new ExceptionsService(prisma() as unknown as PrismaService); await expect(service.list('33333333-3333-4333-8333-333333333333', user)).rejects.toThrow(NotFoundException); });
  it('requires approval before resolution', async () => { const service = new ExceptionsService(prisma('PROPOSED') as unknown as PrismaService); await expect(service.update(org, '22222222-2222-4222-8222-222222222222', { status: 'RESOLVED' }, user)).rejects.toThrow(BadRequestException); });
});
