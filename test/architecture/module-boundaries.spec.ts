import { SessionsService } from '../../src/modules/sessions/sessions.service';
import {
  collectTypeScriptFiles,
  featureFor,
  findGraphCycles,
  readDependencies,
  readSource,
  sourceRoot,
} from './architecture-helpers';

const MODEL_OWNERS = new Map([
  ['User', 'users'],
  ['Workspace', 'workspaces'],
  ['Membership', 'memberships'],
  ['MembershipInvitation', 'memberships'],
  ['Session', 'sessions'],
  ['EmailVerification', 'authentication'],
  ['PasswordResetToken', 'authentication'],
  ['MailOutboxMessage', 'mail'],
  ['AuditLog', 'audit'],
]);
const DELEGATE_OWNERS = new Map(
  [...MODEL_OWNERS].map(([model, owner]) => [
    `${model[0]?.toLocaleLowerCase('en-US')}${model.slice(1)}`,
    owner,
  ]),
);
const CROSS_FEATURE_PUBLIC_CONTRACTS = new Set([
  'src/modules/authentication/decorators/authenticated-request-context.decorator',
  'src/modules/authentication/guards/authenticated-request-context.guard',
  'src/modules/authentication/guards/trusted-origin.guard',
  'src/modules/authorization/decorators/route-admission.decorator',
  'src/modules/authorization/authorization.policy',
  'src/modules/authorization/authorization.errors',
]);

describe('feature ownership and module boundaries', () => {
  const productionFiles = collectTypeScriptFiles(sourceRoot).filter(
    (file) => !file.endsWith('.spec.ts') && !file.includes('/generated/'),
  );
  const dependencies = productionFiles.flatMap(readDependencies);

  it('keeps every Prisma delegate in an owning feature repository', () => {
    const violations: string[] = [];
    for (const file of productionFiles) {
      for (const match of readSource(file).matchAll(
        /\b(?:this\.)?database\.client\.(\w+)/g,
      )) {
        const owner = DELEGATE_OWNERS.get(match[1]);
        if (!owner) {
          violations.push(`${file}: unknown Prisma delegate ${match[1]}`);
        } else if (
          featureFor(file) !== owner ||
          !file.endsWith('.repository.ts')
        ) {
          violations.push(`${file}: ${match[1]} belongs to ${owner}`);
        }
      }
      if (
        /\.(?:\$queryRaw|\$executeRaw|\$queryRawUnsafe|\$executeRawUnsafe)\b/.test(
          readSource(file),
        ) &&
        !file.startsWith('src/infrastructure/database/')
      ) {
        violations.push(`${file}: raw SQL bypasses database infrastructure`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('prevents cross-feature access to repositories and implementation details', () => {
    const violations = dependencies.flatMap(({ source, specifier, target }) => {
      if (source.startsWith('src/products/')) {
        if (
          specifier.startsWith('@prisma/') ||
          target?.startsWith('src/infrastructure/') ||
          target?.includes('/repositories/') ||
          target?.endsWith('.repository')
        ) {
          return [`${source}: product persistence access`];
        }
      }
      if (
        source.startsWith('src/modules/') &&
        target?.startsWith('src/products/')
      ) {
        return [`${source}: Core imports a product`];
      }
      const sourceFeature = featureFor(source);
      const targetFeature = target ? featureFor(target) : undefined;
      if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) {
        return [];
      }
      if (
        target?.includes('/repositories/') ||
        target?.endsWith('.repository') ||
        target?.includes('/cache/') ||
        target?.includes('/rate-limit/') ||
        target?.includes('/providers/') ||
        target?.includes('/worker/')
      ) {
        return [`${source} -> ${target}`];
      }
      if (
        target &&
        !target.endsWith('.module') &&
        !target.endsWith('.service') &&
        !CROSS_FEATURE_PUBLIC_CONTRACTS.has(target)
      ) {
        return [`${source} -> non-public cross-feature file ${target}`];
      }
      return [];
    });
    expect(violations).toEqual([]);
  });

  it('exports only narrow public services and intentional guards', () => {
    const violations = productionFiles
      .filter(
        (file) =>
          file.startsWith('src/modules/') && file.endsWith('.module.ts'),
      )
      .flatMap((file) => {
        const exported = /\bexports\s*:\s*\[([\s\S]*?)\]/.exec(
          readSource(file),
        )?.[1];
        if (!exported) return [];
        const identifiers = exported.match(/\b[A-Z][A-Z_a-z0-9]*\b/g) ?? [];
        return identifiers.flatMap((identifier) =>
          /(?:REPOSITORY|_CACHE|OUTBOUND_MAIL|Repository$|^Prisma)/.test(
            identifier,
          )
            ? [`${file}: exports ${identifier}`]
            : [],
        );
      });
    expect(violations).toEqual([]);
  });

  it('keeps the conventional SessionsService narrow', () => {
    expect(
      Object.getOwnPropertyNames(SessionsService.prototype)
        .filter((method) => method !== 'constructor')
        .sort(),
    ).toEqual(
      [
        'create',
        'findByTokenHash',
        'findLatestForUser',
        'hasActiveContext',
        'revokeAllForUser',
        'revokeActiveForMembership',
        'revokeByTokenHash',
      ].sort(),
    );
  });

  it('keeps the Nest module graph acyclic with one global admission guard', () => {
    const moduleFiles = productionFiles.filter((file) =>
      file.endsWith('.module.ts'),
    );
    const modulesByTarget = new Map(
      moduleFiles.map((file) => [file.slice(0, -3), file]),
    );
    const edges = new Map(
      moduleFiles.map((file) => [
        file,
        readDependencies(file).flatMap(({ target }) => {
          const targetModule = target ? modulesByTarget.get(target) : undefined;
          return targetModule ? [targetModule] : [];
        }),
      ]),
    );
    expect(findGraphCycles(edges)).toEqual([]);
    expect(
      productionFiles.filter((file) =>
        readSource(file).includes('provide: APP_GUARD'),
      ),
    ).toEqual(['src/modules/authorization/authorization.module.ts']);
  });
});
