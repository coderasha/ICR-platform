import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));

const prisma = new PrismaClient();

async function main() {
  const email = 'dev.auth.test@icr.local';

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`Development user already exists: ${email}`);
    console.log('No changes made.');
    return;
  }

  const temporaryPassword = randomBytes(18).toString('base64url');
  const passwordHash = await argon2.hash(temporaryPassword);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Development',
      lastName: 'Tester',
    },
  });

  console.log('Development test user created successfully.');
  console.log(`Email: ${email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log('Store this password securely for the login test.');
}

main()
  .catch((error) => {
    console.error('Failed to create development test user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
