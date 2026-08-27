import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { assertSafeLocalMutationTargets } from '../src/config/local-mutation-target.policy';

const SEED = Object.freeze({
  userId: '01900000-0000-7000-8000-000000000002',
  workspaceId: '01900000-0000-7000-8000-000000000004',
  membershipId: '01900000-0000-7000-8000-000000000005',
  normalizedEmail: 'seed.owner@example.invalid',
  displayName: 'Seed Owner',
  workspaceName: 'Seed Workspace',
});

const SEED_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$m6TgZh+TYlE0sbmXNwsuIw$01f3hHVKm4WKs5fNxApXV9euvbv1DcLnMNRCVNrwy1Y';

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
        const userByEmail = await database.user.findUnique({
          where: { normalizedEmail: SEED.normalizedEmail },
        });
        const user = await database.user.findUnique({
          where: { id: SEED.userId },
        });
        const workspace = await database.workspace.findUnique({
          where: { id: SEED.workspaceId },
        });
        if (
          (userByEmail && userByEmail.id !== SEED.userId) ||
          (user && user.normalizedEmail !== SEED.normalizedEmail) ||
          (workspace && workspace.ownerUserId !== SEED.userId)
        ) {
          throw new Error('Seed identifiers collide with non-seed data.');
        }

        await database.user.upsert({
          where: { id: SEED.userId },
          create: {
            id: SEED.userId,
            normalizedEmail: SEED.normalizedEmail,
            passwordHash: SEED_PASSWORD_HASH,
            displayName: SEED.displayName,
            status: 'ACTIVE',
          },
          update: {
            normalizedEmail: SEED.normalizedEmail,
            displayName: SEED.displayName,
            status: 'ACTIVE',
          },
        });
        await database.workspace.upsert({
          where: { id: SEED.workspaceId },
          create: {
            id: SEED.workspaceId,
            ownerUserId: SEED.userId,
            name: SEED.workspaceName,
          },
          update: { ownerUserId: SEED.userId, name: SEED.workspaceName },
        });
        await database.membership.upsert({
          where: { id: SEED.membershipId },
          create: {
            id: SEED.membershipId,
            workspaceId: SEED.workspaceId,
            userId: SEED.userId,
          },
          update: { removedAt: null },
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
