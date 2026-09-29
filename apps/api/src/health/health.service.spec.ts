import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns ready only after a database probe succeeds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    await expect(new HealthService(prisma).ready()).resolves.toEqual({ status: 'ok' });
  });
  it('does not expose database errors when the service is unavailable', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')) } as unknown as PrismaService;
    await expect(new HealthService(prisma).ready()).rejects.toThrow(new ServiceUnavailableException('Service is not ready'));
  });
});
