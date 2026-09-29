import { ImportStatus, PrismaClient, ReconciliationRunStatus, TransactionStatus } from '@prisma/client';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { canWorkerClaimImport } from './import-lifecycle.js';
import { normalizeCsv } from './csv-normalizer.js';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { matchReconciliationTransactions } from './reconciliation-matching.js';

type ImportJob = { batchId: string; organizationId: string };
const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://:replace_with_a_different_strong_local_password@127.0.0.1:6379', { maxRetriesPerRequest: null });
const storageRoot = resolve(process.env.LOCAL_STORAGE_ROOT ?? '/tmp/icr-storage');
function storagePath(key: string) { const path = resolve(storageRoot, key); if (!path.startsWith(`${storageRoot}${sep}`)) throw new Error('Invalid storage key'); return path; }

const worker = new Worker<ImportJob>('icr-imports', async (job) => {
  const batch = await prisma.importBatch.findFirst({ where: { id: job.data.batchId, organizationId: job.data.organizationId }, select: { id: true, status: true, totalRows: true, storageKey: true, organizationId: true, legalEntityId: true } });
  if (!batch || !canWorkerClaimImport(batch.status)) return;
  await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.PROCESSING, startedAt: new Date(), failureReason: null } });
  try {
    const rows = normalizeCsv((await readFile(storagePath(batch.storageKey))).toString('utf8'));
    await prisma.importRow.createMany({ data: rows.map((row) => ({ importBatchId: batch.id, rowNumber: row.rowNumber, status: row.errors.length === 0 ? 'VALID' : 'REJECTED', rawData: row.raw, normalizedData: row.normalized ?? undefined, errors: row.errors.length ? row.errors : undefined })), skipDuplicates: true });
    const valid = rows.filter((row) => row.errors.length === 0 && row.normalized);
    const keys = valid.map((row) => row.normalized!.sourceRecordKey);
    const existing = await prisma.transaction.findMany({ where: { organizationId: batch.organizationId, sourceRecordKey: { in: keys } }, select: { sourceRecordKey: true } });
    const existingKeys = new Set(existing.map((item) => item.sourceRecordKey));
    const seen = new Set<string>();
    const accepted = valid.filter((row) => { const key = row.normalized!.sourceRecordKey; if (seen.has(key) || existingKeys.has(key)) return false; seen.add(key); return true; });
    await prisma.$transaction(async (transaction) => {
      if (accepted.length) await transaction.transaction.createMany({ data: accepted.map((row) => ({ organizationId: batch.organizationId, legalEntityId: batch.legalEntityId, importBatchId: batch.id, sourceRecordKey: row.normalized!.sourceRecordKey, documentReference: row.normalized!.documentReference, transactionDate: new Date(row.normalized!.transactionDate), amount: row.normalized!.amount, currencyCode: row.normalized!.currencyCode, sourcePayload: row.raw })) });
      if (accepted.length === valid.length) await transaction.importRow.updateMany({ where: { importBatchId: batch.id, status: 'VALID' }, data: { status: 'IMPORTED' } });
      const duplicateCount = valid.length - accepted.length;
      await transaction.importBatch.update({ where: { id: batch.id }, data: { totalRows: rows.length, validRows: valid.length, rejectedRows: rows.length - valid.length, importedRows: accepted.length, status: duplicateCount || rows.length !== valid.length ? ImportStatus.COMPLETED_WITH_ERRORS : ImportStatus.COMPLETED, completedAt: new Date(), failureReason: duplicateCount ? `${duplicateCount} duplicate source record(s) were not imported.` : null } });
    });
  } catch (error) {
    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.FAILED, completedAt: new Date(), failureReason: error instanceof Error ? `CSV staging failed: ${error.message}`.slice(0, 1000) : 'CSV staging failed' } });
  }
}, { connection, concurrency: 2 });

worker.on('failed', (job, error) => console.error('Import job failed', { jobId: job?.id, message: error.message }));

type ReconciliationJob = { runId: string; organizationId: string };
const reconciliationWorker = new Worker<ReconciliationJob>('icr-reconciliation', async (job) => {
  const run = await prisma.reconciliationRun.findFirst({ where: { id: job.data.runId, organizationId: job.data.organizationId }, select: { id: true, status: true, organizationId: true, legalEntityId: true, counterpartLegalEntityId: true, periodStart: true, periodEnd: true } });
  if (!run || run.status !== ReconciliationRunStatus.QUEUED) return;
  if (!run.counterpartLegalEntityId) {
    await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.FAILED, completedAt: new Date(), failureReason: 'A counterpart legal entity is required for execution.' } });
    return;
  }
  await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.PROCESSING, startedAt: new Date(), failureReason: null } });
  try {
    await prisma.$transaction(async (transaction) => {
      const [left, right] = await Promise.all([
        transaction.transaction.findMany({ where: { organizationId: run.organizationId, legalEntityId: run.legalEntityId, status: TransactionStatus.PENDING, transactionDate: { gte: run.periodStart, lte: run.periodEnd } }, select: { id: true, documentReference: true, currencyCode: true, amount: true }, orderBy: { id: 'asc' } }),
        transaction.transaction.findMany({ where: { organizationId: run.organizationId, legalEntityId: run.counterpartLegalEntityId!, status: TransactionStatus.PENDING, transactionDate: { gte: run.periodStart, lte: run.periodEnd } }, select: { id: true, documentReference: true, currencyCode: true, amount: true }, orderBy: { id: 'asc' } }),
      ]);
      const normalize = (item: { id: string; documentReference: string | null; currencyCode: string; amount: { toString(): string } }) => ({ ...item, amount: item.amount.toString() });
      const outcome = matchReconciliationTransactions(left.map(normalize), right.map(normalize));
      const all = [...left, ...right]; const byId = new Map(all.map((item) => [item.id, item]));
      const fingerprint = createHash('sha256').update(all.map((item) => `${item.id}:${item.amount.toString()}:${item.currencyCode}`).join('|')).digest('hex');
      for (const match of outcome.matches) {
        const leftTransaction = byId.get(match.leftId)!;
        await transaction.reconciliationMatch.create({ data: { reconciliationRunId: run.id, ruleCode: 'EXACT_REFERENCE_AMOUNT', currencyCode: leftTransaction.currencyCode, varianceAmount: '0', items: { create: [{ transactionId: match.leftId, side: 'PRIMARY' }, { transactionId: match.rightId, side: 'COUNTERPART' }] } } });
      }
      const unmatched = [...outcome.unmatchedLeftIds, ...outcome.unmatchedRightIds];
      if (unmatched.length) await transaction.reconciliationException.createMany({ data: unmatched.map((id) => { const item = byId.get(id)!; return { organizationId: run.organizationId, legalEntityId: id === item.id && left.some((leftItem) => leftItem.id === id) ? run.legalEntityId : run.counterpartLegalEntityId!, reconciliationRunId: run.id, transactionId: id, exceptionType: 'MISSING_COUNTERPART', severity: 'MEDIUM', currencyCode: item.currencyCode, exposureAmount: item.amount, description: 'No exact opposite-side document-reference match was found in this run.' }; }) });
      const matchedIds = outcome.matches.flatMap((match) => [match.leftId, match.rightId]);
      if (matchedIds.length) await transaction.transaction.updateMany({ where: { id: { in: matchedIds }, status: TransactionStatus.PENDING }, data: { status: TransactionStatus.MATCHED } });
      if (unmatched.length) await transaction.transaction.updateMany({ where: { id: { in: unmatched }, status: TransactionStatus.PENDING }, data: { status: TransactionStatus.EXCEPTION } });
      await transaction.reconciliationRun.update({ where: { id: run.id }, data: { status: unmatched.length ? ReconciliationRunStatus.COMPLETED_WITH_EXCEPTIONS : ReconciliationRunStatus.COMPLETED, inputFingerprint: fingerprint, processedCount: all.length, matchedCount: outcome.matches.length, unmatchedCount: unmatched.length, completedAt: new Date() } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.FAILED, completedAt: new Date(), failureReason: error instanceof Error ? `Reconciliation execution failed: ${error.message}`.slice(0, 1000) : 'Reconciliation execution failed' } });
  }
}, { connection, concurrency: 1 });

reconciliationWorker.on('failed', (job, error) => console.error('Reconciliation job failed', { jobId: job?.id, message: error.message }));
console.log('ICR Platform import and reconciliation workers started');
