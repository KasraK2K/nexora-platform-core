import path from 'node:path';
import nodeProcess from 'node:process';
import ts from 'typescript';

const projectRoot = nodeProcess.cwd();
const configPath = ts.findConfigFile(
  projectRoot,
  ts.sys.fileExists,
  'tsconfig.json',
);

if (!configPath) {
  console.error('Unable to find tsconfig.json.');
  nodeProcess.exitCode = 1;
} else {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    reportDiagnostics([configFile.error]);
    nodeProcess.exitCode = 1;
  } else {
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
      { noEmit: true },
      configPath,
    );

    if (parsedConfig.errors.length > 0) {
      reportDiagnostics(parsedConfig.errors);
      nodeProcess.exitCode = 1;
    } else {
      const program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: parsedConfig.options,
        projectReferences: parsedConfig.projectReferences,
      });
      const checker = program.getTypeChecker();
      const findingsByLocation = new Map();
      const sourceFiles = program
        .getSourceFiles()
        .filter(
          (sourceFile) =>
            !sourceFile.isDeclarationFile &&
            isWithinProject(sourceFile.fileName, projectRoot),
        );

      for (const sourceFile of sourceFiles) {
        for (const diagnostic of program.getSuggestionDiagnostics(sourceFile)) {
          if (
            diagnostic.reportsDeprecated &&
            diagnostic.file &&
            diagnostic.start !== undefined
          ) {
            addFinding(
              diagnostic.file,
              diagnostic.start,
              ts.flattenDiagnosticMessageText(
                diagnostic.messageText,
                ts.sys.newLine,
              ),
            );
          }
        }

        visit(sourceFile);
      }

      const findings = [...findingsByLocation.values()].sort(
        (left, right) =>
          left.file.localeCompare(right.file) ||
          left.line - right.line ||
          left.column - right.column,
      );

      if (findings.length > 0) {
        for (const finding of findings) {
          console.error(
            `${finding.file}:${finding.line}:${finding.column} - ${finding.message}`,
          );
        }
        console.error(`Found ${findings.length} deprecated API use(s).`);
        nodeProcess.exitCode = 1;
      } else {
        console.log('No deprecated TypeScript APIs found.');
      }

      function visit(node) {
        if (ts.isIdentifier(node) && !isImportName(node)) {
          const deprecated = findDeprecatedSymbol(
            checker.getSymbolAtLocation(node),
          );
          if (deprecated) {
            addFinding(node.getSourceFile(), node.getStart(), deprecated);
          }

          if (
            ts.isPropertyAssignment(node.parent) &&
            node.parent.name === node &&
            ts.isObjectLiteralExpression(node.parent.parent)
          ) {
            const contextualType = checker.getContextualType(
              node.parent.parent,
            );
            for (const type of flattenUnion(contextualType)) {
              const contextualDeprecated = findDeprecatedSymbol(
                type.getProperty(node.text),
              );
              if (contextualDeprecated) {
                addFinding(
                  node.getSourceFile(),
                  node.getStart(),
                  contextualDeprecated,
                );
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      function findDeprecatedSymbol(symbol) {
        if (!symbol) {
          return undefined;
        }

        const direct = deprecatedMessage(symbol);
        if (direct) {
          return direct;
        }

        for (const declaration of symbol.getDeclarations() ?? []) {
          const members = declaration.parent?.members;
          if (!members) {
            continue;
          }

          for (const member of members) {
            const siblingName = member.name;
            if (
              siblingName &&
              ts.isIdentifier(siblingName) &&
              siblingName.text !== symbol.getName() &&
              siblingName.text.toLowerCase() === symbol.getName().toLowerCase()
            ) {
              const siblingMessage = deprecatedMessage(
                checker.getSymbolAtLocation(siblingName),
              );
              if (siblingMessage) {
                return siblingMessage;
              }
            }
          }
        }

        return undefined;
      }

      function deprecatedMessage(symbol) {
        const tag = symbol
          ?.getJsDocTags(checker)
          .find((candidate) => candidate.name === 'deprecated');
        return tag
          ? ts.displayPartsToString(tag.text).trim() || 'Deprecated API.'
          : undefined;
      }

      function addFinding(sourceFile, start, message) {
        const key = `${sourceFile.fileName}:${start}`;
        if (findingsByLocation.has(key)) {
          return;
        }

        const position = sourceFile.getLineAndCharacterOfPosition(start);
        findingsByLocation.set(key, {
          file: path.relative(projectRoot, sourceFile.fileName),
          line: position.line + 1,
          column: position.character + 1,
          message,
        });
      }
    }
  }
}

function flattenUnion(type) {
  if (!type) {
    return [];
  }
  return type.isUnion() ? type.types.flatMap(flattenUnion) : [type];
}

function isImportName(node) {
  return (
    ts.isImportSpecifier(node.parent) ||
    ts.isImportClause(node.parent) ||
    ts.isNamespaceImport(node.parent)
  );
}

function isWithinProject(fileName, root) {
  const relative = path.relative(root, fileName);
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

function reportDiagnostics(diagnostics) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => projectRoot,
      getNewLine: () => ts.sys.newLine,
    }),
  );
}
