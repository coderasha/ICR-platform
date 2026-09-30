import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListTransactionsDto } from './dto/list-transactions.dto.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}
  private async scope(org: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(org)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: org }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async list(org: string, dto: ListTransactionsDto, user: AuthenticatedUser) {
    await this.scope(org, user);
    const from = dto.dateFrom ? new Date(dto.dateFrom) : undefined; const to = dto.dateTo ? new Date(dto.dateTo) : undefined;
    if (from && to && from > to) throw new BadRequestException('Start date must not be after end date');
    const where: Prisma.TransactionWhereInput = { organizationId: org, ...(dto.legalEntityId && { legalEntityId: dto.legalEntityId }), ...(dto.search && { documentReference: { contains: dto.search.trim(), mode: 'insensitive' } }), ...(dto.currencyCode && { currencyCode: dto.currencyCode }), ...(dto.status && { status: dto.status }), ...((from || to) && { transactionDate: { ...(from && { gte: from }), ...(to && { lte: to }) } }) };
    const [items, total] = await this.prisma.$transaction([this.prisma.transaction.findMany({ where, include: { legalEntity: { select: { code: true, name: true } } }, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }], skip: (dto.page - 1) * dto.pageSize, take: dto.pageSize }), this.prisma.transaction.count({ where })]);
    return { items, page: dto.page, pageSize: dto.pageSize, total };
  }
  async detail(org: string, id: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, organizationId: org },
      include: {
        legalEntity: { select: { code: true, name: true } },
        importBatch: { select: { id: true, originalFilename: true, status: true, sourceSystem: { select: { code: true, name: true } } } },
        matchItems: {
          include: { reconciliationMatch: { select: { id: true, ruleCode: true, reconciliationRun: { select: { id: true, name: true, status: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
        exceptions: {
          include: { reconciliationRun: { select: { id: true, name: true, status: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }
}
