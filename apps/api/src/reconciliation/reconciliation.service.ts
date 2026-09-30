import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto.js';
import { ReconciliationRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service.js';
import { ListReconciliationRunsDto } from './dto/list-reconciliation-runs.dto.js';

@Injectable()
export class ReconciliationService {
  private readonly connection = new Redis(process.env.REDIS_URL ?? 'redis://:replace_with_a_different_strong_local_password@127.0.0.1:6379', { maxRetriesPerRequest: null, lazyConnect: true });
  private readonly queue = new Queue('icr-reconciliation', { connection: this.connection });
  constructor(private readonly prisma: PrismaService, private readonly audit?: AuditService) {}
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async list(organizationId: string, dto: ListReconciliationRunsDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    return this.prisma.reconciliationRun.findMany({ where: { organizationId, ...(dto.status && { status: dto.status }) }, include: { legalEntity: { select: { code: true, name: true } }, counterpartLegalEntity: { select: { code: true, name: true } }, _count: { select: { matches: true, exceptions: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async detail(organizationId: string, id: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const run = await this.prisma.reconciliationRun.findFirst({
      where: { id, organizationId },
      include: {
        legalEntity: { select: { code: true, name: true } },
        counterpartLegalEntity: { select: { code: true, name: true } },
        matches: {
          include: { items: { include: { transaction: { select: { id: true, documentReference: true, amount: true, currencyCode: true, transactionDate: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
        exceptions: {
          include: { transaction: { select: { documentReference: true, amount: true, currencyCode: true, transactionDate: true } }, legalEntity: { select: { code: true } } },
          orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!run) throw new NotFoundException('Reconciliation run not found');
    return run;
  }
  async create(organizationId: string, dto: CreateReconciliationRunDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const start = new Date(dto.periodStart); const end = new Date(dto.periodEnd);
    if (end < start) throw new BadRequestException('Period end date must not precede the start date');
    if (dto.counterpartLegalEntityId && dto.legalEntityId === dto.counterpartLegalEntityId) throw new BadRequestException('Counterpart legal entity must differ from the primary legal entity');
    const entityIds = dto.counterpartLegalEntityId ? [dto.legalEntityId, dto.counterpartLegalEntityId] : [dto.legalEntityId];
    const entities = await this.prisma.legalEntity.findMany({ where: { id: { in: entityIds }, organizationId, isActive: true }, select: { id: true } });
    if (entities.length !== entityIds.length) throw new BadRequestException('Both legal entities must be active and belong to the selected organization');
    const run = await this.prisma.reconciliationRun.create({ data: { organizationId, legalEntityId: dto.legalEntityId, counterpartLegalEntityId: dto.counterpartLegalEntityId, name: dto.name.trim(), periodStart: start, periodEnd: end, rulesVersion: dto.rulesVersion.trim() } });
    await this.audit?.record({ organizationId, actorUserId: user.id, action: 'RECONCILIATION_RUN_CREATED', entityType: 'ReconciliationRun', entityId: run.id, after: { status: run.status, legalEntityId: run.legalEntityId, counterpartLegalEntityId: run.counterpartLegalEntityId, periodStart: run.periodStart.toISOString(), periodEnd: run.periodEnd.toISOString(), rulesVersion: run.rulesVersion } });
    return run;
  }
  async queueRun(organizationId: string, id: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const run = await this.prisma.reconciliationRun.findFirst({ where: { id, organizationId }, select: { id: true, status: true, counterpartLegalEntityId: true } });
    if (!run) throw new NotFoundException('Reconciliation run not found');
    if (!run.counterpartLegalEntityId) throw new BadRequestException('A counterpart legal entity is required before a run can be executed');
    if (run.status !== ReconciliationRunStatus.DRAFT && run.status !== ReconciliationRunStatus.FAILED) throw new BadRequestException('Only draft or failed reconciliation runs can be queued');
    const queued = await this.prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.QUEUED, queuedAt: new Date(), failureReason: null, startedAt: null, completedAt: null } });
    try {
      await this.queue.add('execute-reconciliation', { runId: run.id, organizationId }, { jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 1000 });
      await this.audit?.record({ organizationId, actorUserId: user.id, action: 'RECONCILIATION_RUN_QUEUED', entityType: 'ReconciliationRun', entityId: queued.id, before: { status: run.status }, after: { status: queued.status } });
      return queued;
    } catch {
      await this.prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.FAILED, failureReason: 'Queue submission failed; retry when queue connectivity is restored.' } });
      throw new BadRequestException('Reconciliation queue is unavailable');
    }
  }
  async cancelRun(organizationId: string, id: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const run = await this.prisma.reconciliationRun.findFirst({ where: { id, organizationId }, select: { id: true, status: true } });
    if (!run) throw new NotFoundException('Reconciliation run not found');
    if (run.status !== ReconciliationRunStatus.DRAFT && run.status !== ReconciliationRunStatus.QUEUED) throw new BadRequestException('Only draft or queued reconciliation runs can be cancelled');
    const cancelled = await this.prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: ReconciliationRunStatus.CANCELLED, completedAt: new Date(), failureReason: null } });
    await this.audit?.record({ organizationId, actorUserId: user.id, action: 'RECONCILIATION_RUN_CANCELLED', entityType: 'ReconciliationRun', entityId: cancelled.id, before: { status: run.status }, after: { status: cancelled.status } });
    return cancelled;
  }
}
