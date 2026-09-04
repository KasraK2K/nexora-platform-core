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

/** Resolves imported identifiers listed in one Nest module's `exports` array. */
export function readNestModuleExportTargets(relativeFile: string): string[] {
  const source = ts.createSourceFile(
    relativeFile,
    readSource(relativeFile),
    ts.ScriptTarget.Latest,
    true,
  );
  const importedTargets = new Map<string, string>();
  source.forEachChild((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      !node.importClause?.namedBindings ||
      !ts.isNamedImports(node.importClause.namedBindings)
    ) {
      return;
    }
    const target = resolveTarget(relativeFile, node.moduleSpecifier.text);
    if (!target) return;
    for (const element of node.importClause.namedBindings.elements) {
      importedTargets.set(element.name.text, target);
    }
  });

  const targets: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      const decorators = ts.canHaveDecorators(node)
        ? ts.getDecorators(node)
        : undefined;
      for (const decorator of decorators ?? []) {
        if (
          !ts.isCallExpression(decorator.expression) ||
          !ts.isIdentifier(decorator.expression.expression) ||
          decorator.expression.expression.text !== 'Module'
        ) {
          continue;
        }
        const metadata = decorator.expression.arguments[0];
        if (!metadata || !ts.isObjectLiteralExpression(metadata)) continue;
        const exportsProperty = metadata.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(source) === 'exports',
        );
        if (
          !exportsProperty ||
          !ts.isArrayLiteralExpression(exportsProperty.initializer)
        ) {
          continue;
        }
        for (const element of exportsProperty.initializer.elements) {
          if (!ts.isIdentifier(element)) continue;
          const target = importedTargets.get(element.text);
          if (target) targets.push(target);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return targets;
}

/** Returns string-literal arguments from calls to one named function. */
export function readStringLiteralCallArguments(
  relativeFile: string,
  functionName: string,
  argumentIndex: number,
  includePropertyAccess = false,
): string[] {
  const source = ts.createSourceFile(
    relativeFile,
    readSource(relativeFile),
    ts.ScriptTarget.Latest,
    true,
  );
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      isNamedCall(node, functionName, includePropertyAccess)
    ) {
      const argument = node.arguments[argumentIndex];
      if (argument && ts.isStringLiteralLike(argument))
        values.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

/** Counts calls to one named function regardless of argument shape. */
export function countCalls(
  relativeFile: string,
  functionName: string,
  includePropertyAccess = false,
): number {
  const source = ts.createSourceFile(
    relativeFile,
    readSource(relativeFile),
    ts.ScriptTarget.Latest,
    true,
  );
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      isNamedCall(node, functionName, includePropertyAccess)
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

function isNamedCall(
  node: ts.CallExpression,
  functionName: string,
  includePropertyAccess: boolean,
): boolean {
  return (
    (ts.isIdentifier(node.expression) &&
      node.expression.text === functionName) ||
    (includePropertyAccess &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === functionName)
  );
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
