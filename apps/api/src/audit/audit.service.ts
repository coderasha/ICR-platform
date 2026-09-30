import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListAuditEventsDto } from './dto/list-audit-events.dto.js';

export type AuditInput = { organizationId: string; actorUserId?: string; action: string; entityType: string; entityId: string; before?: Prisma.InputJsonValue; after?: Prisma.InputJsonValue; metadata?: Prisma.InputJsonValue };

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async record(event: AuditInput) { return this.prisma.auditEvent.create({ data: event }); }
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async list(organizationId: string, dto: ListAuditEventsDto, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const where = { organizationId, ...(dto.action && { action: dto.action }), ...(dto.entityType && { entityType: dto.entityType }) };
    const [total, items] = await this.prisma.$transaction([this.prisma.auditEvent.count({ where }), this.prisma.auditEvent.findMany({ where, include: { actor: { select: { email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, skip: (dto.page - 1) * dto.limit, take: dto.limit })]);
    return { items, total, page: dto.page, limit: dto.limit };
  }
}
