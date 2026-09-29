import { ImportStatus, PrismaClient } from '@prisma/client';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { canWorkerClaimImport } from './import-lifecycle.js';

type ImportJob = { batchId: string; organizationId: string };
const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://:replace_with_a_different_strong_local_password@127.0.0.1:6379', { maxRetriesPerRequest: null });

const worker = new Worker<ImportJob>('icr-imports', async (job) => {
  const batch = await prisma.importBatch.findFirst({ where: { id: job.data.batchId, organizationId: job.data.organizationId }, select: { id: true, status: true, totalRows: true } });
  if (!batch || !canWorkerClaimImport(batch.status)) return;
  await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.PROCESSING, startedAt: new Date(), failureReason: null } });
  // File retrieval and canonical transaction persistence are deliberately not implemented yet.
  // A queued batch without staged rows must fail visibly rather than be reported as imported.
  if (batch.totalRows === 0) {
    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.FAILED, completedAt: new Date(), failureReason: 'No staged rows are available. Complete secure upload and validation before queueing this import.' } });
    return;
  }
  await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.FAILED, completedAt: new Date(), failureReason: 'CSV normalization and transaction persistence are not configured.' } });
}, { connection, concurrency: 2 });

worker.on('failed', (job, error) => console.error('Import job failed', { jobId: job?.id, message: error.message }));
console.log('ICR Platform import worker started');
