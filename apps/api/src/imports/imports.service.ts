import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateImportBatchDto, CreateSourceSystemDto, ListImportBatchesDto, ListImportRowsDto, UploadImportDto } from './dto/imports.dto.js';
import { StorageService } from '../storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ImportsService {
  private readonly connection = new Redis(process.env.REDIS_URL ?? 'redis://:replace_with_a_different_strong_local_password@127.0.0.1:6379', { maxRetriesPerRequest: null, lazyConnect: true });
  private readonly queue = new Queue('icr-imports', { connection: this.connection });
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService, private readonly audit?: AuditService) {}
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  private validateMapping(mapping?: Record<string, string>) {
    if (!mapping) return undefined;
    const required = ['sourceRecordKey', 'transactionDate', 'amount', 'currencyCode']; const allowed = new Set([...required, 'documentReference']);
    const entries = Object.entries(mapping).filter(([, value]) => typeof value === 'string' && value.trim());
    if (entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string' || value.trim().length > 100)) throw new BadRequestException('Column mapping contains an invalid field or header');
    const normalized = Object.fromEntries(entries.map(([key, value]) => [key, value.trim().toLowerCase()]));
    if (required.some((key) => !normalized[key])) throw new BadRequestException('Map source record key, transaction date, amount, and currency code');
    if (new Set(Object.values(normalized)).size !== Object.keys(normalized).length) throw new BadRequestException('Each canonical field must map to a distinct source column');
    return normalized;
  }
  async listSources(organizationId: string, user: AuthenticatedUser) { await this.scope(organizationId, user); return this.prisma.sourceSystem.findMany({ where: { organizationId }, orderBy: { code: 'asc' } }); }
  async createSource(organizationId: string, dto: CreateSourceSystemDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    try { const source = await this.prisma.sourceSystem.create({ data: { organizationId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), systemType: dto.systemType.trim() } }); await this.audit?.record({ organizationId, actorUserId: user.id, action: 'SOURCE_SYSTEM_CREATED', entityType: 'SourceSystem', entityId: source.id, after: { code: source.code, name: source.name, systemType: source.systemType } }); return source; }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Source system code already exists in this organization'); throw error; }
  }
  async listBatches(organizationId: string, dto: ListImportBatchesDto, user: AuthenticatedUser) { await this.scope(organizationId, user); return this.prisma.importBatch.findMany({ where: { organizationId, ...(dto.status && { status: dto.status }) }, include: { legalEntity: { select: { code: true, name: true } }, sourceSystem: { select: { code: true, name: true } } }, orderBy: { createdAt: 'desc' } }); }
  async listRows(organizationId: string, id: string, dto: ListImportRowsDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const batch = await this.prisma.importBatch.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    const where = { importBatchId: batch.id, ...(dto.status && { status: dto.status }) };
    const [total, items] = await this.prisma.$transaction([this.prisma.importRow.count({ where }), this.prisma.importRow.findMany({ where, orderBy: { rowNumber: 'asc' }, skip: (dto.page - 1) * dto.limit, take: dto.limit })]);
    return { items, total, page: dto.page, limit: dto.limit };
  }
  async rejectedRowsCsv(organizationId: string, id: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const batch = await this.prisma.importBatch.findFirst({ where: { id, organizationId }, select: { id: true, originalFilename: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    const rows = await this.prisma.importRow.findMany({ where: { importBatchId: batch.id, status: 'REJECTED' }, select: { rowNumber: true, errors: true, rawData: true }, orderBy: { rowNumber: 'asc' }, take: 10_001 });
    const truncated = rows.length > 10_000; const exported = rows.slice(0, 10_000);
    const cell = (value: unknown) => { const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; };
    const csv = `${[['row_number', 'validation_errors', 'source_row'], ...exported.map((row) => [row.rowNumber, row.errors, row.rawData])].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
    await this.audit?.record({ organizationId, actorUserId: user.id, action: 'IMPORT_REJECTED_ROWS_EXPORTED', entityType: 'ImportBatch', entityId: batch.id, metadata: { exportedRows: exported.length, truncated, maximumRows: 10_000 } });
    return { csv, truncated, filename: batch.originalFilename.replace(/\.csv$/i, '') };
  }
  async createBatch(organizationId: string, dto: CreateImportBatchDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const entity = await this.prisma.legalEntity.findFirst({ where: { id: dto.legalEntityId, organizationId }, select: { id: true } });
    if (!entity) throw new BadRequestException('Legal entity must belong to the selected organization');
    if (dto.sourceSystemId) { const source = await this.prisma.sourceSystem.findFirst({ where: { id: dto.sourceSystemId, organizationId, isActive: true }, select: { id: true } }); if (!source) throw new BadRequestException('Source system must be active and belong to the selected organization'); }
    const safeName = dto.originalFilename.replace(/[^A-Za-z0-9._-]/g, '_');
    try { const batch = await this.prisma.importBatch.create({ data: { organizationId, legalEntityId: dto.legalEntityId, sourceSystemId: dto.sourceSystemId, idempotencyKey: dto.idempotencyKey, originalFilename: safeName, storageKey: `imports/${organizationId}/${randomUUID()}`, contentHash: dto.contentHash.toLowerCase(), fileType: dto.fileType, createdByUserId: user.id } }); await this.audit?.record({ organizationId, actorUserId: user.id, action: 'IMPORT_BATCH_CREATED', entityType: 'ImportBatch', entityId: batch.id, after: { status: batch.status, legalEntityId: batch.legalEntityId, sourceSystemId: batch.sourceSystemId, fileType: batch.fileType, originalFilename: batch.originalFilename } }); return batch; }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An import batch already exists for this idempotency key'); throw error; }
  }
  async upload(organizationId: string, dto: UploadImportDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const content = Buffer.from(dto.contentBase64, 'base64');
    if (content.length > 10 * 1024 * 1024) throw new BadRequestException('Upload exceeds the 10 MB limit');
    const stored = await this.storage.putImport(organizationId, content);
    const columnMapping = this.validateMapping(dto.columnMapping);
    return this.createBatch(organizationId, { legalEntityId: dto.legalEntityId, sourceSystemId: dto.sourceSystemId, idempotencyKey: dto.idempotencyKey, originalFilename: dto.originalFilename, contentHash: stored.sha256, fileType: dto.fileType } as CreateImportBatchDto, user).then(async (batch) => {
      return this.prisma.importBatch.update({ where: { id: batch.id }, data: { storageKey: stored.key, columnMapping } });
    });
  }
  async queueBatch(organizationId: string, id: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const batch = await this.prisma.importBatch.findFirst({ where: { id, organizationId }, select: { id: true, status: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status !== ImportStatus.DRAFT && batch.status !== ImportStatus.FAILED) throw new BadRequestException('Only draft or failed import batches can be queued');
    const queued = await this.prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.QUEUED, queuedAt: new Date(), failureReason: null } });
    try {
      await this.queue.add('process-import', { batchId: batch.id, organizationId }, { jobId: batch.id, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 1000 });
      await this.audit?.record({ organizationId, actorUserId: user.id, action: 'IMPORT_BATCH_QUEUED', entityType: 'ImportBatch', entityId: queued.id, before: { status: batch.status }, after: { status: queued.status } });
      return queued;
    } catch {
      await this.prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.FAILED, failureReason: 'Queue submission failed; retry when queue connectivity is restored.' } });
      throw new BadRequestException('Import queue is unavailable');
    }
  }
  async cancelBatch(organizationId: string, id: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const batch = await this.prisma.importBatch.findFirst({ where: { id, organizationId }, select: { id: true, status: true } });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status !== ImportStatus.DRAFT && batch.status !== ImportStatus.QUEUED) throw new BadRequestException('Only draft or queued import batches can be cancelled');
    const cancelled = await this.prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.CANCELLED, completedAt: new Date(), failureReason: null } });
    await this.audit?.record({ organizationId, actorUserId: user.id, action: 'IMPORT_BATCH_CANCELLED', entityType: 'ImportBatch', entityId: cancelled.id, before: { status: batch.status }, after: { status: cancelled.status } });
    return cancelled;
  }
}
