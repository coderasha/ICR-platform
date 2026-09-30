import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const maximumRows = 10_000;
function cell(value: unknown) { const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' ? value.toString() : JSON.stringify(value); const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safeText.replaceAll('"', '""')}"`; }

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  private async scope(organizationId: string, user: AuthenticatedUser) {
    const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platform && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    if (!await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) throw new NotFoundException('Organization not found');
  }
  async exceptionsCsv(organizationId: string, user: AuthenticatedUser) {
    await this.scope(organizationId, user);
    const records = await this.prisma.reconciliationException.findMany({ where: { organizationId }, include: { legalEntity: { select: { code: true } }, reconciliationRun: { select: { name: true } }, transaction: { select: { documentReference: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: maximumRows + 1 });
    const truncated = records.length > maximumRows; const exported = records.slice(0, maximumRows);
    const rows = [
      ['exception_id', 'exception_type', 'severity', 'status', 'legal_entity', 'run_name', 'document_reference', 'currency', 'exposure_amount', 'description', 'created_at'],
      ...exported.map((item) => [item.id, item.exceptionType, item.severity, item.status, item.legalEntity.code, item.reconciliationRun.name, item.transaction?.documentReference, item.currencyCode, item.exposureAmount?.toString(), item.description, item.createdAt.toISOString()]),
    ];
    await this.audit.record({ organizationId, actorUserId: user.id, action: 'EXCEPTIONS_CSV_EXPORTED', entityType: 'ReconciliationException', entityId: organizationId, metadata: { exportedRows: exported.length, truncated, maximumRows } });
    return { csv: `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`, truncated };
  }
}
