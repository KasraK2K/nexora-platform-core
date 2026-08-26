import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const repositoryRoot = path.resolve(__dirname, '../..');
export const sourceRoot = path.join(repositoryRoot, 'src');

export type Dependency = Readonly<{
  source: string;
  specifier: string;
  target?: string;
}>;

/** Returns every TypeScript source path below a directory. */
export function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      return collectTypeScriptFiles(absolute);
    }
    return absolute.endsWith('.ts')
      ? [normalize(path.relative(repositoryRoot, absolute))]
      : [];
  });
}

/** Returns every directory below and including the supplied directory. */
export function collectDirectories(directory: string): string[] {
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

/** Parses relative import/export declarations and resolves local targets. */
export function readDependencies(relativeFile: string): Dependency[] {
  const source = ts.createSourceFile(
    relativeFile,
    readSource(relativeFile),
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

/** Reads a repository-relative UTF-8 source file. */
export function readSource(relativeFile: string): string {
  return readFileSync(path.join(repositoryRoot, relativeFile), 'utf8');
}

/** Finds cycles in a directed graph and returns readable paths. */
export function findGraphCycles(
  edges: ReadonlyMap<string, readonly string[]>,
): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];

  const visit = (node: string, ancestors: readonly string[]): void => {
    if (visiting.has(node)) {
      cycles.push([...ancestors, node].join(' -> '));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const target of edges.get(node) ?? []) {
      visit(target, [...ancestors, node]);
    }
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of edges.keys()) visit(node, []);
  return cycles;
}

/** Extracts the feature name from a conventional modules path. */
export function featureFor(file: string): string | undefined {
  return /^src\/modules\/([^/]+)\//.exec(file)?.[1];
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

function normalize(value: string): string {
  return value.replaceAll('\\', '/');
}
