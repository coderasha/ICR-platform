import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { CreateExceptionNoteDto } from './dto/create-exception-note.dto.js';
import { UpdateExceptionDto } from './dto/update-exception.dto.js';
import { UploadExceptionAttachmentDto } from './dto/upload-exception-attachment.dto.js';
import { ExceptionsService } from './exceptions.service.js';
import { ListExceptionsDto } from './dto/list-exceptions.dto.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('organizations/:organizationId/exceptions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExceptionsController {
  constructor(private readonly service: ExceptionsService) {}
  @Get() @RequirePermissions('exceptions:read')
  list(@Param('organizationId', ParseUUIDPipe) org: string, @Query() dto: ListExceptionsDto, @Req() req: AuthenticatedRequest) { return this.service.list(org, dto, req.user); }
  @Get(':id/notes') @RequirePermissions('exceptions:read')
  notes(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.service.listNotes(org, id, req.user); }
  @Post(':id/notes') @RequirePermissions('exceptions:resolve')
  createNote(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateExceptionNoteDto, @Req() req: AuthenticatedRequest) { return this.service.createNote(org, id, dto, req.user); }
  @Get(':id/attachments') @RequirePermissions('exceptions:read')
  attachments(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) { return this.service.listAttachments(org, id, req.user); }
  @Post(':id/attachments') @RequirePermissions('exceptions:resolve')
  uploadAttachment(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadExceptionAttachmentDto, @Req() req: AuthenticatedRequest) { return this.service.uploadAttachment(org, id, dto, req.user); }
  @Get(':id/attachments/:attachmentId/download') @RequirePermissions('exceptions:read')
  async downloadAttachment(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Param('attachmentId', ParseUUIDPipe) attachmentId: string, @Req() req: AuthenticatedRequest, @Res() response: Response) {
    const attachment = await this.service.downloadAttachment(org, id, attachmentId, req.user);
    response.setHeader('Content-Type', attachment.contentType); response.setHeader('Content-Length', attachment.content.length); response.setHeader('Content-Disposition', `attachment; filename="${attachment.originalFilename}"`); response.setHeader('X-Content-Type-Options', 'nosniff'); response.send(attachment.content);
  }
  @Patch(':id') @RequirePermissions('exceptions:resolve')
  update(@Param('organizationId', ParseUUIDPipe) org: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExceptionDto, @Req() req: AuthenticatedRequest) { return this.service.update(org, id, dto, req.user); }
}
