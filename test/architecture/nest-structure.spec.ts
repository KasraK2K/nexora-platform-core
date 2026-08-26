import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  collectDirectories,
  collectTypeScriptFiles,
  readDependencies,
  readSource,
  repositoryRoot,
  sourceRoot,
} from './architecture-helpers';

const GENERIC_LAYER_DIRECTORIES = new Set([
  'application',
  'domain',
  'infrastructure',
  'ports',
  'presentation',
]);

describe('conventional NestJS structure', () => {
  const modulesRoot = path.join(sourceRoot, 'modules');
  const productionFiles = collectTypeScriptFiles(modulesRoot).filter(
    (file) => !file.endsWith('.spec.ts'),
  );

  it('gives every feature one obvious root module and keeps src/modules CLI-safe', () => {
    expect(
      readdirSync(modulesRoot).filter((entry) => entry.endsWith('.module.ts')),
    ).toEqual([]);

    const features = readdirSync(modulesRoot).filter((entry) =>
      statSync(path.join(modulesRoot, entry)).isDirectory(),
    );
    expect(
      features.filter(
        (feature) =>
          !existsSync(path.join(modulesRoot, feature, `${feature}.module.ts`)),
      ),
    ).toEqual([]);

    const ambiguous = collectDirectories(modulesRoot).flatMap((directory) => {
      const modules = readdirSync(directory).filter((entry) =>
        entry.endsWith('.module.ts'),
      );
      return modules.length > 1
        ? [`${path.relative(repositoryRoot, directory)}: ${modules.join(', ')}`]
        : [];
    });
    expect(ambiguous).toEqual([]);
  });

  it('uses capability names instead of generic architecture layer folders', () => {
    const genericDirectories = collectDirectories(modulesRoot)
      .filter((directory) =>
        GENERIC_LAYER_DIRECTORIES.has(path.basename(directory)),
      )
      .map((directory) => path.relative(repositoryRoot, directory));
    expect(genericDirectories).toEqual([]);
  });

  it('keeps controllers away from persistence and provider internals', () => {
    const violations = productionFiles
      .filter((file) => file.endsWith('.controller.ts'))
      .flatMap((file) =>
        readDependencies(file).flatMap(({ specifier, target }) => {
          const forbidden =
            specifier.startsWith('@prisma/') ||
            target?.startsWith('src/infrastructure/') ||
            target?.includes('/repositories/') ||
            target?.endsWith('.repository') ||
            target?.includes('/cache/') ||
            target?.includes('/providers/') ||
            target?.includes('/worker/');
          return forbidden ? [`${file} -> ${target ?? specifier}`] : [];
        }),
      );
    expect(violations).toEqual([]);
  });

  it('uses conventional class suffixes for Nest entry points', () => {
    const violations = productionFiles.flatMap((file) => {
      const name = path.basename(file);
      const source = readSource(file);
      if (source.includes('@Controller(') && !name.endsWith('.controller.ts')) {
        return [`${file}: controller filename suffix`];
      }
      if (name.endsWith('.service.ts')) {
        return [...source.matchAll(/\bexport\s+class\s+(\w+)/g)].flatMap(
          ([, className]) =>
            className?.endsWith('Service')
              ? []
              : [`${file}: exported class ${className ?? '<unknown>'}`],
        );
      }
      return [];
    });
    expect(violations).toEqual([]);
  });

  it('registers every feature module explicitly in AppModule', () => {
    const appModule = readSource('src/app.module.ts');
    const features = readdirSync(modulesRoot).filter((entry) =>
      statSync(path.join(modulesRoot, entry)).isDirectory(),
    );
    expect(
      features.filter(
        (feature) =>
          !appModule.includes(`./modules/${feature}/${feature}.module`),
      ),
    ).toEqual([]);
  });

  it('keeps the password blocklist updater on the current security path', () => {
    const updater = readSource('scripts/update-common-password-blocklist.mjs');
    expect(updater).toContain(
      'src/modules/authentication/security/common-password-hashes.generated.ts',
    );
    expect(updater).not.toContain('src/modules/authentication/infrastructure/');
  });
});
