import { SessionsService } from '../../src/modules/sessions/sessions.service';
import {
  collectTypeScriptFiles,
  featureFor,
  findGraphCycles,
  readDependencies,
  readNestModuleExportTargets,
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
  'src/modules/authorization/route-admission.decorator',
  'src/modules/authorization/authorization.policy',
  'src/modules/authorization/authorization.errors',
]);
const ALLOWED_CONTRACT_PACKAGES = new Set([
  '@nestjs/common',
  '@nestjs/core',
  'express',
]);
const PUBLIC_TYPE_CONTRACTS = [
  {
    repository: 'src/modules/sessions/sessions.repository.ts',
    service: 'src/modules/sessions/sessions.service.ts',
    types: './sessions.types',
    names: ['SessionRecord', 'SessionContext', 'RevokedSession'],
  },
  {
    repository: 'src/modules/memberships/memberships.repository.ts',
    service: 'src/modules/memberships/memberships.service.ts',
    types: './memberships.types',
    names: ['MembershipSummary'],
    privateNames: ['MembershipRecord'],
  },
] as const;

describe('feature ownership and module boundaries', () => {
  const productionFiles = collectTypeScriptFiles(sourceRoot).filter(
    (file) => !file.endsWith('.spec.ts') && !file.includes('/generated/'),
  );
  const dependencies = productionFiles.flatMap(readDependencies);
  const exportedServiceTargets = new Set(
    productionFiles
      .filter((file) => file.endsWith('.module.ts'))
      .flatMap(readNestModuleExportTargets)
      .filter((target) => target.endsWith('.service')),
  );

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
        !exportedServiceTargets.has(target) &&
        !CROSS_FEATURE_PUBLIC_CONTRACTS.has(target)
      ) {
        return [`${source} -> non-public cross-feature file ${target}`];
      }
      return [];
    });
    expect(violations).toEqual([]);
  });

  it('allows exactly the documented exceptional cross-feature contracts', () => {
    const actualContracts = new Set(
      dependencies.flatMap(({ source, target }) => {
        const sourceFeature = featureFor(source);
        const targetFeature = target ? featureFor(target) : undefined;
        if (
          !target ||
          !sourceFeature ||
          !targetFeature ||
          sourceFeature === targetFeature ||
          target.endsWith('.module') ||
          exportedServiceTargets.has(target)
        ) {
          return [];
        }
        return [target];
      }),
    );

    expect([...actualContracts].sort()).toEqual(
      [...CROSS_FEATURE_PUBLIC_CONTRACTS].sort(),
    );
  });

  it('keeps exceptional cross-feature contracts dependency-safe', () => {
    const contractFiles = [...CROSS_FEATURE_PUBLIC_CONTRACTS].map(
      (contract) => `${contract}.ts`,
    );
    const inspectedSources = new Set<string>();
    const contractDependencies = contractFiles.flatMap((file) => {
      inspectedSources.add(file);
      return readDependencies(file);
    });
    const violations = contractDependencies.flatMap(
      ({ source, specifier, target }) => {
        if (
          (!target && !ALLOWED_CONTRACT_PACKAGES.has(specifier)) ||
          specifier.startsWith('@prisma/') ||
          target?.startsWith('src/infrastructure/') ||
          target?.startsWith('src/products/') ||
          target?.includes('/repositories/') ||
          target?.endsWith('.repository') ||
          target?.includes('/cache/') ||
          target?.includes('/rate-limit/') ||
          target?.includes('/providers/') ||
          target?.includes('/worker/')
        ) {
          return [
            `${source} -> unsafe contract dependency ${target ?? specifier}`,
          ];
        }
        return [];
      },
    );

    expect([...inspectedSources].sort()).toEqual([...contractFiles].sort());
    expect(violations).toEqual([]);
  });

  it('keeps public result types outside private repositories', () => {
    const violations = PUBLIC_TYPE_CONTRACTS.flatMap((contract) => {
      const repositorySource = readSource(contract.repository);
      const serviceSource = readSource(contract.service);
      const exportedTypes = new Set(
        [
          ...serviceSource.matchAll(
            /export\s+type\s*\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g,
          ),
        ]
          .filter((match) => match[2] === contract.types)
          .flatMap((match) => match[1]?.split(',') ?? [])
          .map((name) => name.trim()),
      );
      const names = [
        ...contract.names,
        ...('privateNames' in contract ? contract.privateNames : []),
      ];
      return [
        ...contract.names.flatMap((name) =>
          exportedTypes.has(name)
            ? []
            : [`${contract.service}: does not re-export ${name}`],
        ),
        ...names.flatMap((name) =>
          new RegExp(`\\bexport\\s+(?:interface|type)\\s+${name}\\b`).test(
            repositorySource,
          )
            ? [`${contract.repository}: exports ${name}`]
            : [],
        ),
      ];
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
