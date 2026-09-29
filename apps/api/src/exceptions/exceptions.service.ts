import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExceptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateExceptionDto } from './dto/update-exception.dto.js';
@Injectable()
export class ExceptionsService {
  constructor(private readonly prisma: PrismaService) {}
  private async scope(org: string, user: AuthenticatedUser) { const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null); if (!platform && !user.organizationIds.includes(org)) throw new NotFoundException('Organization not found'); if (!await this.prisma.organization.findUnique({ where: { id: org }, select: { id: true } })) throw new NotFoundException('Organization not found'); }
  async list(org: string, user: AuthenticatedUser) { await this.scope(org, user); return this.prisma.reconciliationException.findMany({ where: { organizationId: org }, include: { legalEntity: { select: { code: true, name: true } }, reconciliationRun: { select: { name: true, status: true } }, transaction: { select: { documentReference: true, amount: true, currencyCode: true } } }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }] }); }
  async update(org: string, id: string, dto: UpdateExceptionDto, user: AuthenticatedUser) { await this.scope(org, user); const item = await this.prisma.reconciliationException.findFirst({ where: { id, organizationId: org }, select: { id: true, status: true } }); if (!item) throw new NotFoundException('Exception not found'); if (dto.status === 'RESOLVED' && item.status !== ExceptionStatus.APPROVED) throw new BadRequestException('Only approved exceptions can be resolved'); if (dto.status === 'APPROVED' && item.status !== ExceptionStatus.PROPOSED) throw new BadRequestException('Only proposed exceptions can be approved'); return this.prisma.reconciliationException.update({ where: { id: item.id }, data: { ...(dto.assignedToUserId !== undefined && { assignedToUserId: dto.assignedToUserId }), ...(dto.status !== undefined && { status: dto.status }), ...(dto.status === 'RESOLVED' && { resolvedAt: new Date() }) } }); }
}
