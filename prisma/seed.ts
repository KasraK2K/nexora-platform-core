import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { assertSafeLocalMutationTargets } from '../src/core/configuration/local-mutation-target.policy';

const SEED = Object.freeze({
  identityId: '01900000-0000-7000-8000-000000000001',
  userId: '01900000-0000-7000-8000-000000000002',
  organizationId: '01900000-0000-7000-8000-000000000003',
  workspaceId: '01900000-0000-7000-8000-000000000004',
  membershipId: '01900000-0000-7000-8000-000000000005',
  normalizedEmail: 'seed.owner@example.invalid',
  displayName: 'Seed Owner',
  organizationName: 'Seed Organization',
  workspaceName: 'Seed Workspace',
});

async function main(): Promise<void> {
  assertSafeLocalMutationTargets(process.env, 'seed');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Database target is required.');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await prisma.$transaction(
      async (database) => {
        const identityById = await database.identity.findUnique({
          where: { id: SEED.identityId },
        });
        const identityByEmail = await database.identity.findUnique({
          where: { normalizedEmail: SEED.normalizedEmail },
        });
        const user = await database.user.findUnique({
          where: { id: SEED.userId },
        });
        const organization = await database.organization.findUnique({
          where: { id: SEED.organizationId },
        });
        const workspace = await database.workspace.findUnique({
          where: { id: SEED.workspaceId },
        });
        if (
          (identityById &&
            identityById.normalizedEmail !== SEED.normalizedEmail) ||
          (identityByEmail && identityByEmail.id !== SEED.identityId) ||
          (user && user.identityId !== SEED.identityId) ||
          (organization && organization.ownerUserId !== SEED.userId) ||
          (workspace && workspace.organizationId !== SEED.organizationId)
        ) {
          throw new Error('Seed identifiers collide with non-seed data.');
        }

        await database.identity.upsert({
          where: { id: SEED.identityId },
          create: {
            id: SEED.identityId,
            normalizedEmail: SEED.normalizedEmail,
          },
          update: { normalizedEmail: SEED.normalizedEmail },
        });
        await database.user.upsert({
          where: { id: SEED.userId },
          create: {
            id: SEED.userId,
            identityId: SEED.identityId,
            displayName: SEED.displayName,
            status: 'ACTIVE',
          },
          update: { displayName: SEED.displayName, status: 'ACTIVE' },
        });
        await database.organization.upsert({
          where: { id: SEED.organizationId },
          create: {
            id: SEED.organizationId,
            ownerUserId: SEED.userId,
            name: SEED.organizationName,
          },
          update: { name: SEED.organizationName },
        });
        await database.workspace.upsert({
          where: { id: SEED.workspaceId },
          create: {
            id: SEED.workspaceId,
            organizationId: SEED.organizationId,
            name: SEED.workspaceName,
          },
          update: { name: SEED.workspaceName },
        });
        await database.membership.upsert({
          where: { id: SEED.membershipId },
          create: {
            id: SEED.membershipId,
            workspaceId: SEED.workspaceId,
            userId: SEED.userId,
            role: 'OWNER',
          },
          update: { role: 'OWNER', removedAt: null },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    process.stdout.write('Product-neutral local seed is ready.\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Database seed failed.'}\n`,
  );
  process.exitCode = 1;
});
