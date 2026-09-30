import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async scope(org: string, user: AuthenticatedUser) {
    const platform = user.roles.some(
      (role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null,
    );
    if (!platform && !user.organizationIds.includes(org)) {
      throw new NotFoundException('Organization not found');
    }
    if (!await this.prisma.organization.findUnique({ where: { id: org }, select: { id: true } })) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async member(org: string, id: string) {
    const member = await this.prisma.user.findFirst({
      where: { id, organizationAccesses: { some: { organizationId: org } } },
      select: { id: true, isActive: true },
    });
    if (!member) throw new NotFoundException('User not found');
    return member;
  }

  async users(org: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    return this.prisma.user.findMany({
      where: { organizationAccesses: { some: { organizationId: org } } },
      select: {
        id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true,
        organizationAccesses: { where: { organizationId: org }, select: { organizationId: true } },
        roles: {
          where: { OR: [{ organizationId: org }, { organizationId: null }] },
          select: { organizationId: true, role: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { email: 'asc' },
    });
  }

  async roles(org: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    return this.prisma.role.findMany({
      where: { isActive: true, code: { not: 'PLATFORM_ADMIN' } },
      select: { id: true, code: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  async setActive(org: string, id: string, isActive: boolean, user: AuthenticatedUser) {
    await this.scope(org, user);
    if (id === user.id && !isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const member = await this.member(org, id);
    const updated = await this.prisma.user.update({ where: { id }, data: { isActive } });
    await this.audit.record({
      organizationId: org, actorUserId: user.id, action: 'USER_ACTIVE_STATE_UPDATED',
      entityType: 'User', entityId: id, before: { isActive: member.isActive }, after: { isActive: updated.isActive },
    });
    return { id: updated.id, isActive: updated.isActive };
  }

  async assignRole(org: string, id: string, roleId: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    await this.member(org, id);
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, isActive: true, code: { not: 'PLATFORM_ADMIN' } },
      select: { id: true, code: true, name: true },
    });
    if (!role) throw new NotFoundException('Assignable role not found');
    try {
      const assignment = await this.prisma.userRole.create({
        data: { userId: id, roleId: role.id, organizationId: org },
      });
      await this.audit.record({
        organizationId: org, actorUserId: user.id, action: 'USER_ROLE_ASSIGNED',
        entityType: 'UserRole', entityId: assignment.id,
        after: { userId: id, roleCode: role.code, roleName: role.name },
      });
      return assignment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This role is already assigned to the member');
      }
      throw error;
    }
  }

  async removeRole(org: string, id: string, roleId: string, user: AuthenticatedUser) {
    await this.scope(org, user);
    await this.member(org, id);
    const assignment = await this.prisma.userRole.findFirst({
      where: { userId: id, roleId, organizationId: org },
      select: { id: true, role: { select: { code: true, name: true } } },
    });
    if (!assignment) throw new NotFoundException('Role assignment not found');
    await this.prisma.userRole.delete({ where: { id: assignment.id } });
    await this.audit.record({
      organizationId: org, actorUserId: user.id, action: 'USER_ROLE_REMOVED',
      entityType: 'UserRole', entityId: assignment.id,
      before: { userId: id, roleCode: assignment.role.code, roleName: assignment.role.name },
    });
    return { id: assignment.id, removed: true };
  }
}
