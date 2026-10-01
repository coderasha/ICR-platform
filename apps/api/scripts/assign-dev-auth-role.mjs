
import { PrismaClient } from '@prisma/client';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));

const prisma = new PrismaClient();

const userEmail = 'dev.auth.test@icr.local';
const organizationCode = 'ACME';
const roleCode = 'RECONCILIATION_ANALYST';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`Development user not found: ${userEmail}`);
  }

  const organization = await prisma.organization.findUnique({
    where: { code: organizationCode },
    select: { id: true, code: true },
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationCode}`);
  }

  const role = await prisma.role.findUnique({
    where: { code: roleCode },
    select: { id: true, code: true },
  });

  if (!role) {
    throw new Error(`Role not found: ${roleCode}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.userOrganizationAccess.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: organization.id,
      },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: user.id,
          roleId: role.id,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
        organizationId: organization.id,
      },
    });
  });

  console.log('Development role assignment completed.');
  console.log(`User: ${user.email}`);
  console.log(`Organization: ${organization.code}`);
  console.log(`Role: ${role.code}`);
}

main()
  .catch((error) => {
    console.error('Role assignment failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
