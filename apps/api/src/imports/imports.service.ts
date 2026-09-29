import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateImportBatchDto, CreateSourceSystemDto, UploadImportDto } from './dto/imports.dto.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class ImportsService {
  private readonly connection = new Redis(process.env.REDIS_URL ?? 'redis://:replace_with_a_different_strong_local_password@127.0.0.1:6379', { maxRetriesPerRequest: null, lazyConnect: true });
  private readonly queue = new Queue('icr-imports', { connection: this.connection });
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async listSources(organizationId: string, user: AuthenticatedUser) { await this.scope(organizationId, user); return this.prisma.sourceSystem.findMany({ where: { organizationId }, orderBy: { code: 'asc' } }); }
  async createSource(organizationId: string, dto: CreateSourceSystemDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    try { return await this.prisma.sourceSystem.create({ data: { organizationId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), systemType: dto.systemType.trim() } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Source system code already exists in this organization'); throw error; }
  }
  async listBatches(organizationId: string, user: AuthenticatedUser) { await this.scope(organizationId, user); return this.prisma.importBatch.findMany({ where: { organizationId }, include: { legalEntity: { select: { code: true, name: true } }, sourceSystem: { select: { code: true, name: true } } }, orderBy: { createdAt: 'desc' } }); }
  async createBatch(organizationId: string, dto: CreateImportBatchDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const entity = await this.prisma.legalEntity.findFirst({ where: { id: dto.legalEntityId, organizationId }, select: { id: true } });
    if (!entity) throw new BadRequestException('Legal entity must belong to the selected organization');
    if (dto.sourceSystemId) { const source = await this.prisma.sourceSystem.findFirst({ where: { id: dto.sourceSystemId, organizationId, isActive: true }, select: { id: true } }); if (!source) throw new BadRequestException('Source system must be active and belong to the selected organization'); }
    const safeName = dto.originalFilename.replace(/[^A-Za-z0-9._-]/g, '_');
    try { return await this.prisma.importBatch.create({ data: { organizationId, legalEntityId: dto.legalEntityId, sourceSystemId: dto.sourceSystemId, idempotencyKey: dto.idempotencyKey, originalFilename: safeName, storageKey: `imports/${organizationId}/${randomUUID()}`, contentHash: dto.contentHash.toLowerCase(), fileType: dto.fileType, createdByUserId: user.id } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An import batch already exists for this idempotency key'); throw error; }
  }
  async upload(organizationId: string, dto: UploadImportDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const content = Buffer.from(dto.contentBase64, 'base64');
    if (content.length > 10 * 1024 * 1024) throw new BadRequestException('Upload exceeds the 10 MB limit');
    const stored = await this.storage.putImport(organizationId, content);
    return this.createBatch(organizationId, { legalEntityId: dto.legalEntityId, sourceSystemId: dto.sourceSystemId, idempotencyKey: dto.idempotencyKey, originalFilename: dto.originalFilename, contentHash: stored.sha256, fileType: dto.fileType } as CreateImportBatchDto, user).then(async (batch) => {
      return this.prisma.importBatch.update({ where: { id: batch.id }, data: { storageKey: stored.key } });
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
      return queued;
    } catch {
      await this.prisma.importBatch.update({ where: { id: batch.id }, data: { status: ImportStatus.FAILED, failureReason: 'Queue submission failed; retry when queue connectivity is restored.' } });
      throw new BadRequestException('Import queue is unavailable');
    }
  }
}
