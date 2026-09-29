import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateAccountDto,
  CreateCounterpartyDto,
  CreateIntercompanyRelationshipDto,
  UpdateAccountDto,
  UpdateCounterpartyDto,
  UpdateIntercompanyRelationshipDto,
} from './dto/master-data.dto.js';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOrganizationScope(organizationId: string, user: AuthenticatedUser) {
    const platformAdmin = user.roles.some((role) => role.code === 'PLATFORM_ADMIN' && role.organizationId === null);
    if (!platformAdmin && !user.organizationIds.includes(organizationId)) throw new NotFoundException('Organization not found');
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new NotFoundException('Organization not found');
  }

  private async entity(organizationId: string, id: string) {
    const entity = await this.prisma.legalEntity.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!entity) throw new BadRequestException('Legal entity must belong to the selected organization');
    return entity;
  }

  async listCounterparties(organizationId: string, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    return this.prisma.counterparty.findMany({ where: { organizationId }, include: { legalEntity: { select: { code: true, name: true } } }, orderBy: [{ legalEntity: { code: 'asc' } }, { code: 'asc' }] });
  }
  async createCounterparty(organizationId: string, dto: CreateCounterpartyDto, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user); await this.entity(organizationId, dto.legalEntityId);
    try { return await this.prisma.counterparty.create({ data: { organizationId, legalEntityId: dto.legalEntityId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), countryCode: dto.countryCode, currencyCode: dto.currencyCode } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Counterparty code already exists for this legal entity'); throw error; }
  }
  async updateCounterparty(organizationId: string, id: string, dto: UpdateCounterpartyDto, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    const record = await this.prisma.counterparty.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!record) throw new NotFoundException('Counterparty not found');
    return this.prisma.counterparty.update({ where: { id: record.id }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.countryCode !== undefined && { countryCode: dto.countryCode }), ...(dto.currencyCode !== undefined && { currencyCode: dto.currencyCode }), ...(dto.isActive !== undefined && { isActive: dto.isActive }) } });
  }

  async listAccounts(organizationId: string, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    return this.prisma.account.findMany({ where: { organizationId }, include: { legalEntity: { select: { code: true, name: true } } }, orderBy: [{ legalEntity: { code: 'asc' } }, { code: 'asc' }] });
  }
  async createAccount(organizationId: string, dto: CreateAccountDto, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user); await this.entity(organizationId, dto.legalEntityId);
    try { return await this.prisma.account.create({ data: { organizationId, legalEntityId: dto.legalEntityId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), accountType: dto.accountType as AccountType, currencyCode: dto.currencyCode } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Account code already exists for this legal entity'); throw error; }
  }
  async updateAccount(organizationId: string, id: string, dto: UpdateAccountDto, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    const record = await this.prisma.account.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!record) throw new NotFoundException('Account not found');
    return this.prisma.account.update({ where: { id: record.id }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.accountType !== undefined && { accountType: dto.accountType as AccountType }), ...(dto.currencyCode !== undefined && { currencyCode: dto.currencyCode }), ...(dto.isActive !== undefined && { isActive: dto.isActive }) } });
  }

  async listRelationships(organizationId: string, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    return this.prisma.intercompanyRelationship.findMany({ where: { organizationId }, include: { sourceLegalEntity: { select: { code: true, name: true } }, targetLegalEntity: { select: { code: true, name: true } } }, orderBy: { name: 'asc' } });
  }
  async createRelationship(organizationId: string, dto: CreateIntercompanyRelationshipDto, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    if (dto.sourceLegalEntityId === dto.targetLegalEntityId) throw new BadRequestException('Source and target legal entities must differ');
    await Promise.all([this.entity(organizationId, dto.sourceLegalEntityId), this.entity(organizationId, dto.targetLegalEntityId)]);
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
    if (effectiveTo && effectiveTo < effectiveFrom) throw new BadRequestException('Effective end date must not precede the start date');
    try { return await this.prisma.intercompanyRelationship.create({ data: { organizationId, sourceLegalEntityId: dto.sourceLegalEntityId, targetLegalEntityId: dto.targetLegalEntityId, name: dto.name.trim(), effectiveFrom, effectiveTo } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An intercompany relationship already exists for these legal entities'); throw error; }
  }
  async updateRelationship(organizationId: string, id: string, dto: UpdateIntercompanyRelationshipDto, user: AuthenticatedUser) {
    await this.assertOrganizationScope(organizationId, user);
    const record = await this.prisma.intercompanyRelationship.findFirst({ where: { id, organizationId }, select: { id: true, effectiveFrom: true } });
    if (!record) throw new NotFoundException('Intercompany relationship not found');
    const effectiveTo = dto.effectiveTo === undefined ? undefined : dto.effectiveTo === null ? null : new Date(dto.effectiveTo);
    if (effectiveTo && effectiveTo < record.effectiveFrom) throw new BadRequestException('Effective end date must not precede the start date');
    return this.prisma.intercompanyRelationship.update({ where: { id: record.id }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.isActive !== undefined && { isActive: dto.isActive }), ...(effectiveTo !== undefined && { effectiveTo }) } });
  }
}
