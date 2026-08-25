import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const nestCli = path.join(
  repositoryRoot,
  'node_modules',
  '@nestjs',
  'cli',
  'bin',
  'nest.js',
);

const checks = [
  {
    label: 'feature module targets AppModule',
    args: [
      'generate',
      'module',
      'modules/nest-cli-smoke',
      '--dry-run',
      '--no-spec',
    ],
    expected: [
      'CREATE src/modules/nest-cli-smoke/nest-cli-smoke.module.ts',
      'UPDATE src/app.module.ts',
    ],
  },
  {
    label: 'controller targets its owning feature module',
    args: [
      'generate',
      'controller',
      'modules/audit/nest-cli-smoke',
      '--flat',
      '--dry-run',
      '--no-spec',
    ],
    expected: [
      'CREATE src/modules/audit/nest-cli-smoke.controller.ts',
      'UPDATE src/modules/audit/audit.module.ts',
    ],
  },
  {
    label: 'service targets its owning feature module',
    args: [
      'generate',
      'service',
      'modules/audit/nest-cli-smoke',
      '--flat',
      '--dry-run',
      '--no-spec',
    ],
    expected: [
      'CREATE src/modules/audit/nest-cli-smoke.service.ts',
      'UPDATE src/modules/audit/audit.module.ts',
    ],
  },
  {
    label: 'DTO class uses the requested dto filename',
    args: [
      'generate',
      'class',
      'modules/audit/dto/nest-cli-smoke.dto',
      '--flat',
      '--dry-run',
      '--no-spec',
    ],
    expected: ['CREATE src/modules/audit/dto/nest-cli-smoke.dto.ts'],
  },
  {
    label: 'repository interface exposes the installed CLI suffix',
    args: [
      'generate',
      'interface',
      'modules/audit/repositories/nest-cli-smoke.repository',
      '--flat',
      '--dry-run',
      '--no-spec',
    ],
    expected: [
      'CREATE src/modules/audit/repositories/nest-cli-smoke.repository.interface.ts',
    ],
  },
  {
    label: 'repository provider targets its owning feature module',
    args: [
      'generate',
      'provider',
      'modules/audit/infrastructure/prisma-nest-cli-smoke.repository',
      '--flat',
      '--dry-run',
      '--no-spec',
    ],
    expected: [
      'CREATE src/modules/audit/infrastructure/prisma-nest-cli-smoke.repository.ts',
      'UPDATE src/modules/audit/audit.module.ts',
    ],
  },
];

if (!existsSync(nestCli)) {
  fail('The installed Nest CLI entry point was not found. Run pnpm install.');
}

for (const check of checks) {
  const result = spawnSync(process.execPath, [nestCli, ...check.args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    windowsHide: true,
  });
  const output = stripAnsi(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.status !== 0) {
    fail(`${check.label} failed:\n${output.trim()}`);
  }
  for (const expected of check.expected) {
    if (!output.includes(expected)) {
      fail(`${check.label} did not report ${expected}.\n${output.trim()}`);
    }
  }
}

const unexpectedWrites = [
  'src/modules/nest-cli-smoke',
  'src/modules/audit/nest-cli-smoke.controller.ts',
  'src/modules/audit/nest-cli-smoke.service.ts',
  'src/modules/audit/dto/nest-cli-smoke.dto.ts',
  'src/modules/audit/repositories/nest-cli-smoke.repository.interface.ts',
  'src/modules/audit/infrastructure/prisma-nest-cli-smoke.repository.ts',
].filter((entry) => existsSync(path.join(repositoryRoot, entry)));

if (unexpectedWrites.length > 0) {
  fail(
    `Nest CLI dry-run wrote unexpected paths: ${unexpectedWrites.join(', ')}`,
  );
}

console.log('Nest CLI conventional module targeting is valid.');

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
