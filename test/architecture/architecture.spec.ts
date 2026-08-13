import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repositoryRoot = path.resolve(__dirname, '../..');
const sourceRoot = path.join(repositoryRoot, 'src');

type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation';

type Dependency = Readonly<{
  source: string;
  specifier: string;
  target?: string;
}>;

const APPROVED_CROSS_MODULE_EXCEPTIONS = new Set([
  'src/core/authentication/application/register-account.use-case.ts|src/core/identity/domain/identity-already-exists.error',
  'src/core/authentication/domain/registration.errors.ts|src/core/memberships/application/membership-role',
  'src/core/authorization/presentation/route-admission.guard.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/authorization/presentation/route-admission.guard.ts|src/core/authentication/presentation/authenticated-request-context.guard',
  'src/core/authorization/presentation/route-admission.guard.ts|src/core/authentication/presentation/private-response-headers',
  'src/core/authorization/presentation/route-admission.guard.ts|src/core/authentication/presentation/trusted-origin.guard',
  'src/core/health/health.controller.ts|src/core/authorization/presentation/route-admission',
  'src/core/observability/metrics.controller.ts|src/core/authorization/presentation/route-admission',
  'src/core/authentication/presentation/authentication.controller.ts|src/core/authorization/presentation/route-admission',
  'src/core/memberships/presentation/membership-invitations.controller.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/memberships/presentation/membership-invitations.controller.ts|src/core/authorization/presentation/route-admission',
  'src/core/memberships/presentation/membership-invitation-request.guard.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/memberships/presentation/membership-ownership-transfer-request.guard.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/memberships/presentation/memberships.controller.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/memberships/presentation/memberships.controller.ts|src/core/authorization/presentation/route-admission',
  'src/core/users/presentation/users.controller.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/users/presentation/users.controller.ts|src/core/authorization/presentation/route-admission',
  'src/core/workspaces/presentation/workspaces.controller.ts|src/core/authentication/presentation/authenticated-request-context',
  'src/core/workspaces/presentation/workspaces.controller.ts|src/core/authorization/presentation/route-admission',
]);

const MODEL_OWNERS = new Map([
  ['Identity', 'identity'],
  ['PasswordCredential', 'identity'],
  ['User', 'users'],
  ['Organization', 'organizations'],
  ['Workspace', 'workspaces'],
  ['Membership', 'memberships'],
  ['MembershipInvitation', 'memberships'],
  ['Session', 'authentication'],
  ['EmailVerification', 'authentication'],
  ['PasswordResetToken', 'authentication'],
  ['MailOutboxMessage', 'mail'],
  ['AuditLog', 'audit'],
]);

const DELEGATE_OWNERS = new Map(
  [...MODEL_OWNERS].map(([model, owner]) => [lowerFirst(model), owner]),
);

describe('architecture dependency gates', () => {
  const productionFiles = collectTypeScriptFiles(sourceRoot).filter(
    (file) => !file.endsWith('.spec.ts') && !file.includes('/generated/'),
  );
  const dependencies = productionFiles.flatMap(readDependencies);

  it('keeps dependencies inward and preserves Core/product boundaries', () => {
    const violations = dependencies.flatMap((dependency) => {
      const violation = dependencyViolation(dependency);
      return violation ? [`${dependency.source}: ${violation}`] : [];
    });
    expect(violations).toEqual([]);
  });

  it('keeps every Prisma delegate inside its owning module infrastructure', () => {
    const schema = readFileSync(
      path.join(repositoryRoot, 'prisma/schema.prisma'),
      'utf8',
    );
    const schemaModels = [...schema.matchAll(/^model\s+(\w+)/gm)].map(
      (match) => match[1],
    );
    expect(new Set(schemaModels)).toEqual(new Set(MODEL_OWNERS.keys()));

    const violations: string[] = [];
    for (const file of productionFiles) {
      const source = readFileSync(path.join(repositoryRoot, file), 'utf8');
      for (const match of source.matchAll(
        /\b(?:this\.)?database\.client\.(\w+)/g,
      )) {
        const delegate = match[1];
        const owner = DELEGATE_OWNERS.get(delegate);
        if (!owner) {
          violations.push(`${file}: unknown Prisma delegate ${delegate}`);
          continue;
        }
        if (!file.startsWith(`src/core/${owner}/infrastructure/`)) {
          violations.push(
            `${file}: ${delegate} is owned by core/${owner}/infrastructure`,
          );
        }
      }
      if (
        /\.(?:\$queryRaw|\$executeRaw|\$queryRawUnsafe|\$executeRawUnsafe)\b/.test(
          source,
        ) &&
        !file.startsWith('src/core/persistence/')
      ) {
        violations.push(`${file}: raw SQL bypasses module-owned repositories`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('exercises allowed and denied classifier paths', () => {
    expect(
      dependencyViolation({
        source: 'src/products/example/application/use-case.ts',
        specifier: '../../../core/users/application/users',
        target: 'src/core/users/application/users',
      }),
    ).toBeUndefined();
    expect(
      dependencyViolation({
        source: 'src/products/example/infrastructure/repository.ts',
        specifier: '@prisma/client',
      }),
    ).toContain('product modules cannot access Prisma');
    expect(
      dependencyViolation({
        source: 'src/products/example/infrastructure/repository.ts',
        specifier: 'src/core/persistence/database.service',
        target: 'src/core/persistence/database.service',
      }),
    ).toContain('product modules cannot access Prisma');
    expect(
      dependencyViolation({
        source: 'src/core/users/domain/user.ts',
        specifier: '../infrastructure/prisma-users.repository',
        target: 'src/core/users/infrastructure/prisma-users.repository',
      }),
    ).toContain('domain');
    expect(
      dependencyViolation({
        source: 'src/core/users/application/users.ts',
        specifier: '../../products/example/application/use-case',
        target: 'src/products/example/application/use-case',
      }),
    ).toContain('Core cannot import product modules');
  });
});

function dependencyViolation(dependency: Dependency): string | undefined {
  const { source, specifier, target } = dependency;
  const sourceBoundary = parseBoundary(source);
  const targetBoundary = target ? parseBoundary(target) : undefined;

  if (source.startsWith('src/core/') && target?.startsWith('src/products/')) {
    return 'Core cannot import product modules';
  }
  if (source.startsWith('src/products/')) {
    if (
      specifier === '@prisma/client' ||
      specifier === '@prisma/adapter-pg' ||
      target?.startsWith('src/core/persistence/') ||
      target?.includes('/infrastructure/') ||
      target?.endsWith('src/core/core-infrastructure.module')
    ) {
      return 'product modules cannot access Prisma or Core infrastructure';
    }
    if (
      target?.startsWith('src/core/') &&
      targetBoundary?.layer !== 'application'
    ) {
      return 'product modules may consume only Core application contracts';
    }
  }

  if (!sourceBoundary) return undefined;
  if (
    sourceBoundary.layer === 'domain' &&
    (specifier.startsWith('@nestjs/') ||
      specifier.startsWith('@prisma/') ||
      ['redis', 'express', 'nodemailer', 'zod'].includes(specifier))
  ) {
    return `domain cannot import framework package ${specifier}`;
  }
  if (!target) return undefined;
  if (
    sourceBoundary.layer === 'domain' &&
    !(
      target.startsWith(`src/core/${sourceBoundary.module}/domain/`) ||
      target.startsWith('src/shared/domain/')
    ) &&
    !isApprovedException(source, target)
  ) {
    return 'domain may depend only on its own domain and shared domain';
  }
  if (
    sourceBoundary.layer === 'application' &&
    targetBoundary &&
    targetBoundary.module === sourceBoundary.module &&
    ['presentation', 'infrastructure'].includes(targetBoundary.layer ?? '')
  ) {
    return `application cannot depend on ${targetBoundary.layer}`;
  }
  if (
    sourceBoundary.layer === 'presentation' &&
    targetBoundary?.module === sourceBoundary.module &&
    targetBoundary.layer === 'infrastructure'
  ) {
    return 'presentation cannot depend on infrastructure';
  }
  if (
    sourceBoundary.layer === 'infrastructure' &&
    targetBoundary?.module === sourceBoundary.module &&
    targetBoundary.layer === 'presentation'
  ) {
    return 'infrastructure cannot depend on presentation';
  }

  if (!targetBoundary || targetBoundary.module === sourceBoundary.module) {
    return undefined;
  }
  if (isApprovedException(source, target)) return undefined;
  if (targetBoundary.layer === 'application') return undefined;
  if (
    targetBoundary.module === 'configuration' &&
    targetBoundary.layer === undefined
  ) {
    return undefined;
  }
  if (
    sourceBoundary.layer === 'infrastructure' &&
    ['persistence', 'redis'].includes(targetBoundary.module)
  ) {
    return undefined;
  }
  if (
    source.endsWith('.module.ts') &&
    (target.endsWith('.module') ||
      target.endsWith('core-infrastructure.module'))
  ) {
    return undefined;
  }
  return `cross-module dependency reaches ${targetBoundary.module}/${targetBoundary.layer ?? 'root'}`;
}

function readDependencies(relativeFile: string): Dependency[] {
  const absoluteFile = path.join(repositoryRoot, relativeFile);
  const source = ts.createSourceFile(
    relativeFile,
    readFileSync(absoluteFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const dependencies: Dependency[] = [];
  source.forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      dependencies.push({
        source: relativeFile,
        specifier,
        target: resolveTarget(relativeFile, specifier),
      });
    }
  });
  return dependencies;
}

function resolveTarget(source: string, specifier: string): string | undefined {
  if (specifier.startsWith('src/')) return normalize(specifier);
  if (!specifier.startsWith('.')) return undefined;
  return normalize(
    path.relative(
      repositoryRoot,
      path.resolve(repositoryRoot, path.dirname(source), specifier),
    ),
  );
}

function parseBoundary(
  file: string,
): { module: string; layer?: Layer } | undefined {
  const match =
    /^src\/(?:core|products)\/([^/]+)(?:\/(domain|application|infrastructure|presentation))?\//.exec(
      file,
    );
  if (!match) return undefined;
  const layer = match[2];
  return {
    module: match[1],
    ...(isLayer(layer) ? { layer } : {}),
  };
}

function isApprovedException(source: string, target: string): boolean {
  return APPROVED_CROSS_MODULE_EXCEPTIONS.has(`${source}|${target}`);
}

function isLayer(value: string | undefined): value is Layer {
  return (
    value === 'domain' ||
    value === 'application' ||
    value === 'infrastructure' ||
    value === 'presentation'
  );
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory())
      return collectTypeScriptFiles(absolute);
    return absolute.endsWith('.ts')
      ? [normalize(path.relative(repositoryRoot, absolute))]
      : [];
  });
}

function normalize(value: string): string {
  return value.replaceAll('\\', '/');
}

function lowerFirst(value: string): string {
  return `${value[0].toLocaleLowerCase('en-US')}${value.slice(1)}`;
}
