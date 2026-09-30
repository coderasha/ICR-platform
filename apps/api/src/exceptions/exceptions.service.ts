import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ExceptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateExceptionDto } from './dto/update-exception.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateExceptionNoteDto } from './dto/create-exception-note.dto.js';
import { UploadExceptionAttachmentDto } from './dto/upload-exception-attachment.dto.js';
import { StorageService } from '../storage/storage.service.js';
import { ListExceptionsDto } from './dto/list-exceptions.dto.js';
@Injectable()
export class ExceptionsService {
  constructor(private readonly prisma: PrismaService, private readonly audit?: AuditService, private readonly storage?: StorageService) {}
  private async scope(org: string, user: AuthenticatedUser) { const platform = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null); if (!platform && !user.organizationIds.includes(org)) throw new NotFoundException('Organization not found'); if (!await this.prisma.organization.findUnique({ where: { id: org }, select: { id: true } })) throw new NotFoundException('Organization not found'); }
  async list(org: string, dto: ListExceptionsDto, user: AuthenticatedUser) { await this.scope(org, user); return this.prisma.reconciliationException.findMany({ where: { organizationId: org, ...(dto.severity && { severity: dto.severity }), ...(dto.assignedToMe && { assignedToUserId: user.id }), ...(dto.overdue && { dueAt: { lt: new Date() } }), AND: [...(dto.status ? [{ status: dto.status }] : []), ...(dto.overdue ? [{ status: { not: ExceptionStatus.RESOLVED } }] : [])] }, include: { legalEntity: { select: { code: true, name: true } }, reconciliationRun: { select: { name: true, status: true } }, transaction: { select: { documentReference: true, amount: true, currencyCode: true } } }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }] }); }
  async update(org: string, id: string, dto: UpdateExceptionDto, user: AuthenticatedUser) {
    await this.scope(org, user);
    const item = await this.prisma.reconciliationException.findFirst({ where: { id, organizationId: org }, select: { id: true, status: true, assignedToUserId: true, dueAt: true } });
    if (!item) throw new NotFoundException('Exception not found');
    if (!dto.status && dto.assignedToUserId === undefined && dto.dueAt === undefined) throw new BadRequestException('Provide an assignment, due date, or lifecycle action');
    if (dto.status === 'APPROVED') { if (!user.permissions.includes('approvals:approve')) throw new ForbiddenException('Approval permission is required'); if (item.status !== ExceptionStatus.PROPOSED) throw new BadRequestException('Only proposed exceptions can be approved'); }
    else { if (!user.permissions.includes('exceptions:resolve')) throw new ForbiddenException('Exception workflow permission is required'); if (dto.status === 'PROPOSED' && item.status !== ExceptionStatus.OPEN && item.status !== ExceptionStatus.ASSIGNED) throw new BadRequestException('Only open or assigned exceptions can be proposed'); if (dto.status === 'RESOLVED' && item.status !== ExceptionStatus.APPROVED) throw new BadRequestException('Only approved exceptions can be resolved'); if (dto.status === 'ASSIGNED' && dto.assignedToUserId !== user.id) throw new BadRequestException('Exceptions can only be assigned to the current user through this endpoint'); }
    if (dto.assignedToUserId !== undefined && dto.assignedToUserId !== user.id) throw new BadRequestException('Exceptions can only be assigned to the current user through this endpoint');
    const updated = await this.prisma.reconciliationException.update({ where: { id: item.id }, data: { ...(dto.assignedToUserId !== undefined && { assignedToUserId: dto.assignedToUserId }), ...(dto.status !== undefined && { status: dto.status }), ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }), ...(dto.status === 'RESOLVED' && { resolvedAt: new Date() }) } });
    await this.audit?.record({ organizationId: org, actorUserId: user.id, action: dto.status === 'APPROVED' ? 'RECONCILIATION_EXCEPTION_APPROVED' : 'RECONCILIATION_EXCEPTION_UPDATED', entityType: 'ReconciliationException', entityId: updated.id, before: { status: item.status, assignedToUserId: item.assignedToUserId, dueAt: item.dueAt?.toISOString() ?? null }, after: { status: updated.status, assignedToUserId: updated.assignedToUserId, dueAt: updated.dueAt?.toISOString() ?? null } });
    return updated;
  }
  async listNotes(org: string, id: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    const item = await this.prisma.reconciliationException.findFirst({ where: { id, organizationId: org }, select: { id: true } });
    if (!item) throw new NotFoundException('Exception not found');
    return this.prisma.exceptionNote.findMany({ where: { organizationId: org, reconciliationExceptionId: item.id }, include: { author: { select: { email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } });
  }
  async createNote(org: string, id: string, dto: CreateExceptionNoteDto, user: AuthenticatedUser) {
    await this.scope(org, user);
    const item = await this.prisma.reconciliationException.findFirst({ where: { id, organizationId: org }, select: { id: true } });
    if (!item) throw new NotFoundException('Exception not found');
    const note = await this.prisma.exceptionNote.create({ data: { organizationId: org, reconciliationExceptionId: item.id, authorUserId: user.id, body: dto.body.trim() } });
    await this.audit?.record({ organizationId: org, actorUserId: user.id, action: 'RECONCILIATION_EXCEPTION_NOTE_CREATED', entityType: 'ReconciliationException', entityId: item.id, metadata: { noteId: note.id } });
    return note;
  }
  async listAttachments(org: string, id: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    const item = await this.prisma.reconciliationException.findFirst({ where: { id, organizationId: org }, select: { id: true } });
    if (!item) throw new NotFoundException('Exception not found');
    return this.prisma.exceptionAttachment.findMany({ where: { organizationId: org, reconciliationExceptionId: item.id }, include: { uploadedBy: { select: { email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async uploadAttachment(org: string, id: string, dto: UploadExceptionAttachmentDto, user: AuthenticatedUser) {
    await this.scope(org, user);
    const item = await this.prisma.reconciliationException.findFirst({ where: { id, organizationId: org }, select: { id: true } });
    if (!item) throw new NotFoundException('Exception not found');
    if (!this.storage) throw new ServiceUnavailableException('Evidence storage is unavailable');
    const content = Buffer.from(dto.contentBase64, 'base64');
    if (content.length === 0 || content.length > 5 * 1024 * 1024) throw new BadRequestException('Attachment must be between 1 byte and 5 MB');
    const originalFilename = dto.originalFilename.trim().replace(/[^A-Za-z0-9._-]/g, '_');
    if (!originalFilename) throw new BadRequestException('Attachment filename is invalid');
    const stored = await this.storage.putExceptionEvidence(org, content);
    try {
      const attachment = await this.prisma.exceptionAttachment.create({ data: { organizationId: org, reconciliationExceptionId: item.id, uploadedByUserId: user.id, originalFilename, storageKey: stored.key, contentType: dto.contentType, sizeBytes: stored.size, contentHash: stored.sha256 } });
      await this.audit?.record({ organizationId: org, actorUserId: user.id, action: 'RECONCILIATION_EXCEPTION_ATTACHMENT_UPLOADED', entityType: 'ReconciliationException', entityId: item.id, metadata: { attachmentId: attachment.id, contentType: attachment.contentType, sizeBytes: attachment.sizeBytes, contentHash: attachment.contentHash } });
      return attachment;
    } catch (error) { await this.storage.remove(stored.key).catch(() => undefined); throw error; }
  }
  async downloadAttachment(org: string, id: string, attachmentId: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    const attachment = await this.prisma.exceptionAttachment.findFirst({ where: { id: attachmentId, organizationId: org, reconciliationExceptionId: id }, select: { id: true, originalFilename: true, contentType: true, storageKey: true, sizeBytes: true } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (!this.storage) throw new ServiceUnavailableException('Evidence storage is unavailable');
    const content = await this.storage.get(attachment.storageKey);
    await this.audit?.record({ organizationId: org, actorUserId: user.id, action: 'RECONCILIATION_EXCEPTION_ATTACHMENT_DOWNLOADED', entityType: 'ReconciliationException', entityId: id, metadata: { attachmentId: attachment.id, contentType: attachment.contentType, sizeBytes: attachment.sizeBytes } });
    return { ...attachment, content };
  }
}
