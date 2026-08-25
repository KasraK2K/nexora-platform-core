import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { SessionStateService } from '../../src/modules/authentication/session-state/session-state.service';

const repositoryRoot = path.resolve(__dirname, '../..');
const sourceRoot = path.join(repositoryRoot, 'src');

type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation';

type Boundary = Readonly<{
  namespace: 'core' | 'modules' | 'products';
  module: string;
  layer?: Layer;
}>;

type Dependency = Readonly<{
  source: string;
  specifier: string;
  target?: string;
}>;

const APPROVED_CROSS_MODULE_EXCEPTIONS = new Set([
  'src/modules/authorization/guards/route-admission.guard.ts|src/modules/authentication/decorators/authenticated-request-context.decorator',
  'src/modules/authorization/guards/route-admission.guard.ts|src/modules/authentication/guards/authenticated-request-context.guard',
  'src/modules/authorization/guards/route-admission.guard.ts|src/modules/authentication/http/private-response-headers',
  'src/modules/authorization/guards/route-admission.guard.ts|src/modules/authentication/guards/trusted-origin.guard',
]);

const PUBLIC_PRESENTATION_CONTRACTS = new Set([
  'src/modules/authentication/decorators/authenticated-request-context.decorator',
  'src/modules/authorization/decorators/route-admission.decorator',
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
        if (!file.startsWith(`src/modules/${owner}/infrastructure/`)) {
          violations.push(
            `${file}: ${delegate} is owned by modules/${owner}/infrastructure`,
          );
        }
      }
      if (
        /\.(?:\$queryRaw|\$executeRaw|\$queryRawUnsafe|\$executeRawUnsafe)\b/.test(
          source,
        ) &&
        !file.startsWith('src/infrastructure/database/')
      ) {
        violations.push(`${file}: raw SQL bypasses module-owned repositories`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps a single conventional Nest module entry point per directory', () => {
    const modulesRoot = path.join(sourceRoot, 'modules');
    if (!existsSync(modulesRoot)) return;

    const rootModuleFiles = readdirSync(modulesRoot).filter((entry) =>
      entry.endsWith('.module.ts'),
    );
    expect(rootModuleFiles).toEqual([]);

    const featureDirectories = readdirSync(modulesRoot).filter((entry) =>
      statSync(path.join(modulesRoot, entry)).isDirectory(),
    );
    const missingFeatureModules = featureDirectories.filter(
      (feature) =>
        !existsSync(path.join(modulesRoot, feature, `${feature}.module.ts`)),
    );
    expect(missingFeatureModules).toEqual([]);

    const ambiguousDirectories = collectDirectories(modulesRoot).flatMap(
      (directory) => {
        const moduleFiles = readdirSync(directory).filter((entry) =>
          entry.endsWith('.module.ts'),
        );
        return moduleFiles.length > 1
          ? [
              `${normalize(path.relative(repositoryRoot, directory))}: ${moduleFiles.join(', ')}`,
            ]
          : [];
      },
    );
    expect(ambiguousDirectories).toEqual([]);
  });

  it('keeps the Nest module graph acyclic and installs one global guard', () => {
    const moduleFiles = productionFiles.filter((file) =>
      file.endsWith('.module.ts'),
    );
    const moduleByTarget = new Map(
      moduleFiles.map((file) => [file.slice(0, -3), file]),
    );
    const moduleEdges = new Map(
      moduleFiles.map((file) => [
        file,
        readDependencies(file).flatMap((dependency) => {
          const targetModule = dependency.target
            ? moduleByTarget.get(dependency.target)
            : undefined;
          return targetModule ? [targetModule] : [];
        }),
      ]),
    );

    expect(findGraphCycles(moduleEdges)).toEqual([]);

    const globalGuardProviders = productionFiles.flatMap((file) => {
      const source = readFileSync(path.join(repositoryRoot, file), 'utf8');
      return source.includes('provide: APP_GUARD') ? [file] : [];
    });
    expect(globalGuardProviders).toEqual([
      'src/modules/authorization/authorization.module.ts',
    ]);
  });

  it('keeps repository tokens and infrastructure adapters private to modules', () => {
    const moduleFiles = productionFiles.filter(
      (file) => file.startsWith('src/modules/') && file.endsWith('.module.ts'),
    );
    const violations = moduleFiles.flatMap((file) => {
      const source = readFileSync(path.join(repositoryRoot, file), 'utf8');
      const exportsMatch = /\bexports\s*:\s*\[([\s\S]*?)\]/.exec(source);
      if (!exportsMatch?.[1]) return [];
      const exportedIdentifiers =
        exportsMatch[1].match(/\b[A-Z][A-Z_a-z0-9]*\b/g) ?? [];
      return exportedIdentifiers.flatMap((identifier) =>
        /(?:REPOSITORY|_CACHE|OUTBOUND_MAIL|^Prisma|Repository$)/.test(
          identifier,
        )
          ? [`${file}: exports private provider ${identifier}`]
          : [],
      );
    });
    expect(violations).toEqual([]);
  });

  it('keeps the exported session-state cycle breaker capability-narrow', () => {
    const publicMethods = Object.getOwnPropertyNames(
      SessionStateService.prototype,
    )
      .filter((method) => method !== 'constructor')
      .sort();
    expect(publicMethods).toEqual(
      [
        'clearCachesBestEffort',
        'hasActiveContext',
        'revokeActiveForMembership',
      ].sort(),
    );

    const broadStoreConsumers = dependencies
      .filter((dependency) =>
        dependency.target?.endsWith(
          'modules/authentication/application/session-store.service',
        ),
      )
      .map((dependency) => dependency.source)
      .filter((source) => !source.startsWith('src/modules/authentication/'));
    expect(broadStoreConsumers).toEqual([]);

    const authenticationModule = readFileSync(
      path.join(
        repositoryRoot,
        'src/modules/authentication/authentication.module.ts',
      ),
      'utf8',
    );
    const exportsMatch = /\bexports\s*:\s*\[([\s\S]*?)\]/.exec(
      authenticationModule,
    );
    expect(exportsMatch?.[1]).not.toContain('SessionStoreService');
  });

  it('preserves workflow-specific logger contexts after service consolidation', () => {
    const expectedContexts = new Map<string, readonly string[]>([
      [
        'src/modules/authentication/services/sessions.service.ts',
        ['CreateSession', 'ListSessionWorkspaces', 'SwitchWorkspace'],
      ],
      [
        'src/modules/authentication/services/password.service.ts',
        ['RequestPasswordReset', 'ResetPassword', 'ChangePassword'],
      ],
      [
        'src/modules/authentication/services/email-verification.service.ts',
        ['RequestEmailVerification', 'VerifyEmail'],
      ],
      [
        'src/modules/memberships/memberships.service.ts',
        [
          'ListWorkspaceMemberships',
          'LeaveCurrentWorkspace',
          'ChangeMembershipRole',
          'RemoveMembership',
          'TransferWorkspaceOwnership',
        ],
      ],
      [
        'src/modules/memberships/membership-invitations.service.ts',
        [
          'CreateMembershipInvitation',
          'AcceptMembershipInvitation',
          'RevokeMembershipInvitation',
        ],
      ],
    ]);

    for (const [file, expected] of expectedContexts) {
      const source = readFileSync(path.join(repositoryRoot, file), 'utf8');
      const actual = [...source.matchAll(/new Logger\(\s*'([^']+)'/g)].map(
        (match) => match[1],
      );
      expect(actual).toEqual(expected);
    }
  });

  it('exercises allowed and denied classifier paths', () => {
    expect(
      dependencyViolation({
        source: 'src/products/example/application/use-case.ts',
        specifier: '../../../modules/users/users.service',
        target: 'src/modules/users/users.service',
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
        specifier: 'src/infrastructure/database/prisma.service',
        target: 'src/infrastructure/database/prisma.service',
      }),
    ).toContain('product modules cannot access Prisma');
    expect(
      dependencyViolation({
        source: 'src/modules/users/domain/user.ts',
        specifier: '../infrastructure/prisma-users.repository',
        target: 'src/modules/users/infrastructure/prisma-users.repository',
      }),
    ).toContain('domain');
    expect(
      dependencyViolation({
        source: 'src/modules/users/users.service.ts',
        specifier: '../../products/example/application/use-case',
        target: 'src/products/example/application/use-case',
      }),
    ).toContain('Core cannot import product modules');
    expect(
      parseBoundary('src/modules/users/users.controller.ts'),
    ).toMatchObject({ module: 'users', layer: 'presentation' });
    expect(parseBoundary('src/modules/users/users.service.ts')).toMatchObject({
      module: 'users',
      layer: 'application',
    });
    expect(
      parseBoundary('src/modules/users/dto/update-user.dto.ts'),
    ).toMatchObject({ module: 'users', layer: 'presentation' });
    expect(
      dependencyViolation({
        source: 'src/modules/users/users.controller.ts',
        specifier: './repositories/users.repository',
        target: 'src/modules/users/repositories/users.repository',
      }),
    ).toContain('presentation adapters cannot access persistence');
    expect(
      dependencyViolation({
        source: 'src/modules/users/users.controller.ts',
        specifier: '../workspaces/infrastructure/prisma-workspaces.repository',
        target:
          'src/modules/workspaces/infrastructure/prisma-workspaces.repository',
      }),
    ).toContain('presentation adapters cannot access persistence');
  });
});

function dependencyViolation(dependency: Dependency): string | undefined {
  const { source, specifier, target } = dependency;
  const sourceBoundary = parseBoundary(source);
  const targetBoundary = target ? parseBoundary(target) : undefined;

  if (isCoreModulePath(source) && target?.startsWith('src/products/')) {
    return 'Core cannot import product modules';
  }
  if (source.startsWith('src/products/')) {
    if (
      specifier === '@prisma/client' ||
      specifier === '@prisma/adapter-pg' ||
      target?.startsWith('src/infrastructure/') ||
      target?.includes('/infrastructure/') ||
      target?.endsWith('src/modules/infrastructure.module')
    ) {
      return 'product modules cannot access Prisma or Core infrastructure';
    }
    if (
      target &&
      isCoreModulePath(target) &&
      targetBoundary?.layer !== 'application'
    ) {
      return 'product modules may consume only Core application contracts';
    }
  }

  if (!sourceBoundary) return undefined;
  if (
    sourceBoundary.layer === 'presentation' &&
    (specifier === '@prisma/client' ||
      specifier === '@prisma/adapter-pg' ||
      target?.includes('/repositories/') ||
      target?.includes('/infrastructure/') ||
      target?.startsWith('src/infrastructure/'))
  ) {
    return 'controllers and presentation adapters cannot access persistence';
  }
  if (
    sourceBoundary.layer === 'domain' &&
    (specifier.startsWith('@nestjs/') ||
      specifier.startsWith('@prisma/') ||
      ['redis', 'express', 'resend', 'zod'].includes(specifier))
  ) {
    return `domain cannot import framework package ${specifier}`;
  }
  if (!target) return undefined;
  if (isApprovedException(source, target)) return undefined;
  if (
    sourceBoundary.layer === 'presentation' &&
    PUBLIC_PRESENTATION_CONTRACTS.has(target)
  ) {
    return undefined;
  }
  if (
    sourceBoundary.layer === 'domain' &&
    !(
      target.startsWith(
        `src/${sourceBoundary.namespace}/${sourceBoundary.module}/domain/`,
      ) || target.startsWith('src/common/domain/')
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
  if (targetBoundary.layer === 'application') {
    if (target.endsWith('.service')) return undefined;
    return 'cross-module application imports must use public services';
  }
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
    (target.endsWith('.module') || target.endsWith('infrastructure.module'))
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

function parseBoundary(file: string): Boundary | undefined {
  const match = /^src\/(core|modules|products)\/([^/]+)(?:\/([^/]+))?/.exec(
    file,
  );
  if (!match) return undefined;
  const namespace = match[1];
  const module = match[2];
  if (!isBoundaryNamespace(namespace) || !module || module.endsWith('.ts')) {
    return undefined;
  }

  const segment = match[3];
  const layer = layerForPath(file, segment);
  return {
    namespace,
    module,
    ...(layer ? { layer } : {}),
  };
}

function layerForPath(
  file: string,
  segment: string | undefined,
): Layer | undefined {
  if (segment === 'domain') return 'domain';
  if (segment === 'infrastructure') return 'infrastructure';
  if (['application', 'services', 'repositories'].includes(segment ?? '')) {
    return 'application';
  }
  if (
    ['presentation', 'controllers', 'dto', 'guards', 'decorators'].includes(
      segment ?? '',
    )
  ) {
    return 'presentation';
  }
  if (/\.(?:controller|guard|decorator|dto)(?:\.ts)?$/.test(file)) {
    return 'presentation';
  }
  if (/\.service(?:\.ts)?$/.test(file)) return 'application';
  return undefined;
}

function isBoundaryNamespace(
  value: string | undefined,
): value is Boundary['namespace'] {
  return value === 'core' || value === 'modules' || value === 'products';
}

function isCoreModulePath(file: string): boolean {
  return file.startsWith('src/modules/');
}

function isApprovedException(source: string, target: string): boolean {
  return APPROVED_CROSS_MODULE_EXCEPTIONS.has(`${source}|${target}`);
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

function collectDirectories(directory: string): string[] {
  return [
    directory,
    ...readdirSync(directory).flatMap((entry) => {
      const absolute = path.join(directory, entry);
      return statSync(absolute).isDirectory()
        ? collectDirectories(absolute)
        : [];
    }),
  ];
}

function findGraphCycles(
  edges: ReadonlyMap<string, readonly string[]>,
): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];

  const visit = (node: string, pathToNode: readonly string[]): void => {
    if (visiting.has(node)) {
      cycles.push([...pathToNode, node].join(' -> '));
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    for (const target of edges.get(node) ?? []) {
      visit(target, [...pathToNode, node]);
    }
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of edges.keys()) visit(node, []);
  return cycles;
}

function normalize(value: string): string {
  return value.replaceAll('\\', '/');
}

function lowerFirst(value: string): string {
  return `${value[0].toLocaleLowerCase('en-US')}${value.slice(1)}`;
}
