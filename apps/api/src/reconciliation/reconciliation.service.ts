import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto.js';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async list(organizationId: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    return this.prisma.reconciliationRun.findMany({ where: { organizationId }, include: { legalEntity: { select: { code: true, name: true } }, _count: { select: { matches: true, exceptions: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async create(organizationId: string, dto: CreateReconciliationRunDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const start = new Date(dto.periodStart); const end = new Date(dto.periodEnd);
    if (end < start) throw new BadRequestException('Period end date must not precede the start date');
    const entity = await this.prisma.legalEntity.findFirst({ where: { id: dto.legalEntityId, organizationId, isActive: true }, select: { id: true } });
    if (!entity) throw new BadRequestException('Legal entity must be active and belong to the selected organization');
    return this.prisma.reconciliationRun.create({ data: { organizationId, legalEntityId: dto.legalEntityId, name: dto.name.trim(), periodStart: start, periodEnd: end, rulesVersion: dto.rulesVersion.trim() } });
  }
}
