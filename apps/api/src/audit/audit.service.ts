import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
  async list(organizationId: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    return this.prisma.auditEvent.findMany({ where: { organizationId }, include: { actor: { select: { email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
