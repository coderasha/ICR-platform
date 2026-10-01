import { PrismaClient } from '@prisma/client';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));

const prisma = new PrismaClient();

const permissions = [
  ['organizations:read', 'View organizations'],
  ['organizations:manage', 'Manage organizations'],
  ['master_data:read', 'View organization master data'],
  ['master_data:manage', 'Manage organization master data'],
  ['imports:read', 'View import batches and source systems'],
  ['imports:manage', 'Manage import batches and source systems'],
  ['reconciliation:read', 'View reconciliation records'],
  ['reconciliation:execute', 'Execute reconciliation'],
  ['exceptions:read', 'View reconciliation exceptions'],
  ['exceptions:resolve', 'Resolve reconciliation exceptions'],
  ['reports:read', 'View reports'],
  ['reports:export', 'Export reports'],
  ['approvals:read', 'View approval requests'],
  ['approvals:approve', 'Approve eligible requests'],
  ['audit:read', 'View audit records'],
  ['platform:users:manage', 'Manage platform users'],
  ['platform:roles:manage', 'Manage platform roles and permissions'],
];

const roleDefinitions = [
  {
    code: 'PLATFORM_ADMIN',
    name: 'Platform Administrator',
    description: 'Platform-wide administration',
    permissions: permissions.map(([code]) => code),
  },
  {
    code: 'ORG_ADMIN',
    name: 'Organization Administrator',
    description: 'Manage organization-level operations',
    permissions: [
      'organizations:read',
      'organizations:manage',
      'master_data:read',
      'master_data:manage',
      'imports:read',
      'imports:manage',
      'reconciliation:read',
      'reconciliation:execute',
      'exceptions:read',
      'exceptions:resolve',
      'reports:read',
      'reports:export',
      'approvals:read',
      'approvals:approve',
      'audit:read',
    ],
  },
  {
    code: 'RECONCILIATION_ANALYST',
    name: 'Reconciliation Analyst',
    description: 'Analyze and execute reconciliation',
    permissions: [
      'organizations:read',
      'reconciliation:read',
      'reconciliation:execute',
      'exceptions:read',
      'reports:read',
    ],
  },
  {
    code: 'RECONCILIATION_REVIEWER',
    name: 'Reconciliation Reviewer',
    description: 'Review reconciliation results and exceptions',
    permissions: [
      'organizations:read',
      'reconciliation:read',
      'exceptions:read',
      'exceptions:resolve',
      'reports:read',
    ],
  },
  {
    code: 'APPROVER',
    name: 'Approver',
    description: 'Review and approve eligible requests',
    permissions: [
      'organizations:read',
      'approvals:read',
      'approvals:approve',
      'reports:read',
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Auditor',
    description: 'Read-only operational and audit access',
    permissions: [
      'organizations:read',
      'reconciliation:read',
      'exceptions:read',
      'reports:read',
      'reports:export',
      'approvals:read',
      'audit:read',
    ],
  },
];

async function main() {
  const permissionRecords = new Map();

  for (const [code, name] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });

    permissionRecords.set(code, permission);
  }

  const roleRecords = new Map();

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        description: definition.description,
      },
      create: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
      },
    });

    roleRecords.set(definition.code, role);
  }

  for (const definition of roleDefinitions) {
    const role = roleRecords.get(definition.code);

    for (const permissionCode of definition.permissions) {
      const permission = permissionRecords.get(permissionCode);

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log(`Permissions seeded: ${permissionRecords.size}`);
  console.log(`Roles seeded: ${roleRecords.size}`);
  console.log('Role-permission mappings seeded.');
}

main()
  .catch((error) => {
    console.error('RBAC seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
