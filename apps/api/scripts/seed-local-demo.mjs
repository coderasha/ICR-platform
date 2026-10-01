import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));

if (process.env.NODE_ENV === 'production') {
  throw new Error('The local demo seed must never run in production');
}

const prisma = new PrismaClient();
const password = process.env.DEV_PASSWORD ?? 'local-development-only';
const personas = [
  { email: 'platform.admin@icr.local', firstName: 'Platform', lastName: 'Administrator', roleCode: 'PLATFORM_ADMIN', platform: true },
  { email: 'org.admin@icr.local', firstName: 'Organization', lastName: 'Administrator', roleCode: 'ORG_ADMIN' },
  { email: 'analyst@icr.local', firstName: 'Reconciliation', lastName: 'Analyst', roleCode: 'RECONCILIATION_ANALYST' },
  { email: 'reviewer@icr.local', firstName: 'Reconciliation', lastName: 'Reviewer', roleCode: 'RECONCILIATION_REVIEWER' },
  { email: 'approver@icr.local', firstName: 'Close', lastName: 'Approver', roleCode: 'APPROVER' },
  { email: 'auditor@icr.local', firstName: 'Audit', lastName: 'Viewer', roleCode: 'AUDITOR' },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { code: 'ACME' }, update: { name: 'ACME Group' }, create: { code: 'ACME', name: 'ACME Group' },
  });
  for (const entity of [
    { code: 'ACME-IN', name: 'ACME India Private Limited', currencyCode: 'INR' },
    { code: 'ACME-US', name: 'ACME USA Inc.', currencyCode: 'USD' },
  ]) {
    await prisma.legalEntity.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: entity.code } },
      update: { name: entity.name, currencyCode: entity.currencyCode, isActive: true },
      create: { organizationId: organization.id, ...entity },
    });
  }
  const passwordHash = await argon2.hash(password);
  for (const persona of personas) {
    const user = await prisma.user.upsert({
      where: { email: persona.email },
      update: { isActive: true, passwordHash, firstName: persona.firstName, lastName: persona.lastName },
      create: { email: persona.email, passwordHash, firstName: persona.firstName, lastName: persona.lastName },
    });
    const role = await prisma.role.findUnique({ where: { code: persona.roleCode }, select: { id: true } });
    if (!role) throw new Error('RBAC roles are not seeded. Run seed-rbac.mjs first.');
    if (!persona.platform) {
      await prisma.userOrganizationAccess.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
        update: {}, create: { userId: user.id, organizationId: organization.id },
      });
    }
    const organizationId = persona.platform ? null : organization.id;
    const assigned = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, organizationId }, select: { id: true } });
    if (!assigned) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, organizationId } });
  }
  console.log(`Local demo personas ready: ${personas.map((persona) => persona.email).join(', ')}`);
  if (!process.env.DEV_PASSWORD) console.log('Password for every local demo persona: local-development-only');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
