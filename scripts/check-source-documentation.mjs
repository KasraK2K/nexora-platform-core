import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourceRoot = path.resolve('src');
const sourceFiles = [];

/** Tells whether a path relative to `src` belongs to Compodoc's corpus. */
function isIncludedSourcePath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  return (
    normalized.endsWith('.ts') &&
    !normalized.endsWith('.spec.ts') &&
    !normalized.endsWith('.generated.ts') &&
    !normalized.startsWith('generated/')
  );
}

/** Collects production TypeScript files that Compodoc is expected to explain. */
function collectSourceFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath);
      continue;
    }
    if (isIncludedSourcePath(path.relative(sourceRoot, absolutePath))) {
      sourceFiles.push(absolutePath);
    }
  }
}

/** Returns whether a declaration has one TypeScript modifier such as `export`. */
function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === kind));
}

/** Checks for a JSDoc block immediately leading a declaration or its decorators. */
function hasPlainLanguageJsDoc(node, sourceFile) {
  const ranges =
    ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
  return ranges.some((range) => {
    const comment = sourceFile.text.slice(range.pos, range.end);
    if (!comment.startsWith('/**')) return false;
    const proseWords = comment
      .replace(/^\/\*\*|\*\/$/g, '')
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => line && !line.startsWith('@'))
      .join(' ')
      .split(/\s+/);
    return proseWords.length >= 3;
  });
}

/** Reads the simple identifier used for a documented declaration. */
function declarationName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (node.name && ts.isStringLiteral(node.name)) return node.name.text;
  return undefined;
}

/**
 * Protects the documentation gate's own exclusion and JSDoc parsing behavior
 * from silent changes in path handling or the TypeScript compiler API.
 */
function verifyScannerContract() {
  const pathCases = [
    ['core/example.ts', true],
    ['core/example.spec.ts', false],
    ['core/example.generated.ts', false],
    ['generated/example.ts', false],
    ['core/generated/example.ts', true],
    [
      path.relative(
        path.join('checkout', 'generated', 'src'),
        path.join('checkout', 'generated', 'src', 'core', 'example.ts'),
      ),
      true,
    ],
  ];
  for (const [filePath, expected] of pathCases) {
    if (isIncludedSourcePath(filePath) !== expected) {
      throw new Error(`Documentation path rule failed for ${filePath}.`);
    }
  }

  const commentCases = [
    ['/** Explains this local class. */\nclass Example {}', true],
    ['/** @internal */\nclass Example {}', false],
    ['/** */\nclass Example {}', false],
  ];
  for (const [sourceText, expected] of commentCases) {
    const sourceFile = ts.createSourceFile(
      'scanner-contract.ts',
      sourceText,
      ts.ScriptTarget.Latest,
      true,
    );
    if (
      hasPlainLanguageJsDoc(sourceFile.statements[0], sourceFile) !== expected
    ) {
      throw new Error('Documentation summary rule failed its self-check.');
    }
  }
}

verifyScannerContract();
collectSourceFiles(sourceRoot);
const missing = [];

for (const file of sourceFiles.sort()) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  /** Records a declaration whose purpose would be missing from IDE/Compodoc help. */
  function reportMissing(node, kind, name) {
    if (hasPlainLanguageJsDoc(node, sourceFile)) return;
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1;
    missing.push(
      `${path.relative(process.cwd(), file)}:${line} ${kind} ${name}`,
    );
  }

  for (const statement of sourceFile.statements) {
    const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    if (
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      (exported &&
        (ts.isTypeAliasDeclaration(statement) ||
          ts.isEnumDeclaration(statement)))
    ) {
      reportMissing(
        statement,
        ts.SyntaxKind[statement.kind],
        declarationName(statement) ?? '<anonymous>',
      );
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      reportMissing(
        statement,
        exported ? 'ExportedFunction' : 'LocalFunction',
        statement.name.text,
      );
    } else if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          reportMissing(statement, 'ExportedVariable', declaration.name.text);
        }
      }
    }

    if (
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement)
    ) {
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) && !ts.isMethodSignature(member)) {
          continue;
        }
        if (
          hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
          hasModifier(member, ts.SyntaxKind.ProtectedKeyword)
        ) {
          continue;
        }
        const memberName = declarationName(member);
        if (memberName) {
          reportMissing(
            member,
            'PublicMethod',
            `${declarationName(statement)}.${memberName}`,
          );
        }
      }
    }
  }
}

if (missing.length > 0) {
  console.error(
    `Missing plain-language JSDoc on ${missing.length} production declarations:`,
  );
  for (const entry of missing) console.error(`- ${entry}`);
  process.exitCode = 1;
} else {
  console.log(
    `Source documentation check passed (${sourceFiles.length} production TypeScript files).`,
  );
}
