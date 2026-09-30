import { Injectable, NotFoundException } from '@nestjs/common';
import { ExceptionStatus, ReconciliationRunStatus, TransactionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async summary(organizationId: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const [transactions, matchedTransactions, openExceptions, completedRuns] = await Promise.all([
      this.prisma.transaction.count({ where: { organizationId } }),
      this.prisma.transaction.count({ where: { organizationId, status: TransactionStatus.MATCHED } }),
      this.prisma.reconciliationException.count({ where: { organizationId, status: { not: ExceptionStatus.RESOLVED } } }),
      this.prisma.reconciliationRun.count({ where: { organizationId, status: { in: [ReconciliationRunStatus.COMPLETED, ReconciliationRunStatus.COMPLETED_WITH_EXCEPTIONS] } } }),
    ]);
    const closeReadiness = transactions === 0 ? { status: 'AWAITING_DATA', reason: 'No transactions have been imported.' } : completedRuns === 0 ? { status: 'AWAITING_RECONCILIATION', reason: 'No reconciliation run has completed.' } : openExceptions > 0 ? { status: 'BLOCKED', reason: `${openExceptions} unresolved exception${openExceptions === 1 ? '' : 's'} remain.` } : { status: 'READY', reason: 'Completed reconciliation runs have no unresolved exceptions.' };
    return { transactions, matchedTransactions, openExceptions, completedRuns, closeReadiness };
  }
}
