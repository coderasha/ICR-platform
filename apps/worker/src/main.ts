import { ImportStatus, PrismaClient, ReconciliationPeriodStatus, ReconciliationRunStatus, TransactionStatus } from '@prisma/client';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { canWorkerClaimImport } from './import-lifecycle.js';
import { normalizeCsv } from './csv-normalizer.js';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { matchReconciliationTransactions } from './reconciliation-matching.js';
import { assertWorkerStorageConfiguration, assertWorkerStorageReady, readStoredObject } from './object-storage.js';

type ImportJob = { batchId: string; organizationId: string };

function workbookToCsv(content: Buffer): string {
  const workbook = XLSX.read(content, { type: 'buffer', cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error('Workbook does not contain a worksheet');
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet], { blankrows: false });
}

if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) throw new Error('REDIS_URL must be configured for the worker in production');
assertWorkerStorageConfiguration();
if (process.env.NODE_ENV === 'production') await assertWorkerStorageReady();
const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://:replace_with_a_different_strong_local_password@127.0.0.1:6379', { maxRetriesPerRequest: null });

const worker = new Worker<ImportJob>('icr-imports', async (job) => {
  const batch = await prisma.importBatch.findFirst({ where: { id: job.data.batchId, organizationId: job.data.organizationId }, select: { id: true, status: true, totalRows: true, storageKey: true, columnMapping: true, fileType: true, organizationId: true, legalEntityId: true } });
  if (!batch || !canWorkerClaimImport(batch.status)) return;
  await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.PROCESSING, startedAt: new Date(), failureReason: null } });
  try {
    const content = await readStoredObject(batch.storageKey);
    const input = batch.fileType === 'XLSX'
      ? workbookToCsv(content)
      : content.toString('utf8');
    const rows = normalizeCsv(input, batch.columnMapping as Record<string, string> | undefined);
    const normalizedDates = rows.flatMap((row) => row.normalized ? [new Date(row.normalized.transactionDate)] : []);
    if (normalizedDates.length) {
      const earliest = new Date(Math.min(...normalizedDates.map((date) => date.getTime()))); const latest = new Date(Math.max(...normalizedDates.map((date) => date.getTime())));
      const closedPeriods = await prisma.reconciliationPeriod.findMany({ where: { organizationId: batch.organizationId, status: ReconciliationPeriodStatus.CLOSED, periodStart: { lte: latest }, periodEnd: { gte: earliest } }, select: { name: true, periodStart: true, periodEnd: true } });
      const locked = closedPeriods.find((period) => normalizedDates.some((date) => date >= period.periodStart && date <= period.periodEnd));
      if (locked) throw new Error(`Import contains transactions in closed reconciliation period: ${locked.name}`);
    }
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
      const finalStatus = duplicateCount || rows.length !== valid.length ? ImportStatus.COMPLETED_WITH_ERRORS : ImportStatus.COMPLETED;
      await transaction.importBatch.update({ where: { id: batch.id }, data: { totalRows: rows.length, validRows: valid.length, rejectedRows: rows.length - valid.length, importedRows: accepted.length, status: finalStatus, completedAt: new Date(), failureReason: duplicateCount ? `${duplicateCount} duplicate source record(s) were not imported.` : null } });
      await transaction.auditEvent.create({ data: { organizationId: batch.organizationId, action: 'IMPORT_BATCH_COMPLETED', entityType: 'ImportBatch', entityId: batch.id, before: { status: ImportStatus.PROCESSING }, after: { status: finalStatus, totalRows: rows.length, validRows: valid.length, rejectedRows: rows.length - valid.length, importedRows: accepted.length }, metadata: { worker: 'icr-imports', duplicateCount } } });
    });
  } catch (error) {
    const failureReason = error instanceof Error ? `CSV staging failed: ${error.message}`.slice(0, 1000) : 'CSV staging failed';
    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.FAILED, completedAt: new Date(), failureReason } });
    await prisma.auditEvent.create({ data: { organizationId: batch.organizationId, action: 'IMPORT_BATCH_FAILED', entityType: 'ImportBatch', entityId: batch.id, before: { status: ImportStatus.PROCESSING }, after: { status: ImportStatus.FAILED }, metadata: { worker: 'icr-imports', failureReason } } });
  }
}, { connection, concurrency: 2 });

worker.on('failed', (job, error) => console.error('Import job failed', { jobId: job?.id, message: error.message }));

type ReconciliationJob = { runId: string; organizationId: string };
const reconciliationWorker = new Worker<ReconciliationJob>('icr-reconciliation', async (job) => {
  const run = await prisma.reconciliationRun.findFirst({ where: { id: job.data.runId, organizationId: job.data.organizationId }, select: { id: true, status: true, organizationId: true, legalEntityId: true, counterpartLegalEntityId: true, periodStart: true, periodEnd: true, rulesVersion: true } });
  if (!run || run.status !== ReconciliationRunStatus.QUEUED) return;
  if (!run.counterpartLegalEntityId) {
    await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.FAILED, completedAt: new Date(), failureReason: 'A counterpart legal entity is required for execution.' } });
    return;
  }
  if (run.rulesVersion !== 'exact-reference-v1') {
    await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.FAILED, completedAt: new Date(), failureReason: `Unsupported reconciliation rules version: ${run.rulesVersion}` } });
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
      const finalStatus = unmatched.length ? ReconciliationRunStatus.COMPLETED_WITH_EXCEPTIONS : ReconciliationRunStatus.COMPLETED;
      await transaction.reconciliationRun.update({ where: { id: run.id }, data: { status: finalStatus, inputFingerprint: fingerprint, processedCount: all.length, matchedCount: outcome.matches.length, unmatchedCount: unmatched.length, completedAt: new Date() } });
      await transaction.auditEvent.create({ data: { organizationId: run.organizationId, action: 'RECONCILIATION_RUN_COMPLETED', entityType: 'ReconciliationRun', entityId: run.id, before: { status: ReconciliationRunStatus.PROCESSING }, after: { status: finalStatus, processedCount: all.length, matchedCount: outcome.matches.length, unmatchedCount: unmatched.length, inputFingerprint: fingerprint }, metadata: { worker: 'icr-reconciliation', rulesVersion: 'exact-reference-v1' } } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    const failureReason = error instanceof Error ? `Reconciliation execution failed: ${error.message}`.slice(0, 1000) : 'Reconciliation execution failed';
    await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.FAILED, completedAt: new Date(), failureReason } });
    await prisma.auditEvent.create({ data: { organizationId: run.organizationId, action: 'RECONCILIATION_RUN_FAILED', entityType: 'ReconciliationRun', entityId: run.id, before: { status: ReconciliationRunStatus.PROCESSING }, after: { status: ReconciliationRunStatus.FAILED }, metadata: { worker: 'icr-reconciliation', failureReason } } });
  }
}, { connection, concurrency: 1 });

reconciliationWorker.on('failed', (job, error) => console.error('Reconciliation job failed', { jobId: job?.id, message: error.message }));
console.log('ICR Platform import and reconciliation workers started');
