import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { createOpenApiDocument } from '../src/configure-app';

const contractPath = path.resolve('docs/reference/openapi.json');

async function main(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  try {
    const document = createOpenApiDocument(app);
    validateSecurityReferences(document);
    const serialized = `${JSON.stringify(sortObjectKeys(document), null, 2)}\n`;
    if (process.argv.includes('--check')) {
      const committed = await readFile(contractPath, 'utf8').catch(() => '');
      if (committed !== serialized) {
        throw new Error(
          'OpenAPI contract drift detected. Run pnpm run contract:generate and review the diff.',
        );
      }
      process.stdout.write(
        'OpenAPI contract matches the committed artifact.\n',
      );
      return;
    }
    await mkdir(path.dirname(contractPath), { recursive: true });
    await writeFile(contractPath, serialized, 'utf8');
    process.stdout.write(`OpenAPI contract written to ${contractPath}.\n`);
  } finally {
    await app.close();
  }
}

function validateSecurityReferences(document: OpenAPIObject): void {
  if (Object.keys(document.paths).length === 0) {
    throw new Error('OpenAPI generation produced no paths.');
  }
  const schemes = new Set(
    Object.keys(document.components?.securitySchemes ?? {}),
  );
  for (const pathItem of Object.values(document.paths)) {
    if (!pathItem) continue;
    for (const operation of Object.values(pathItem)) {
      if (!isRecord(operation) || !Array.isArray(operation.security)) continue;
      for (const requirement of operation.security) {
        if (!isRecord(requirement)) continue;
        for (const securityName of Object.keys(requirement)) {
          if (!schemes.has(securityName)) {
            throw new Error(
              `OpenAPI operation references undefined security scheme ${securityName}.`,
            );
          }
        }
      }
    }
  }
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareObjectKeys)
      .map((key) => [key, sortObjectKeys(value[key])]),
  );
}

function compareObjectKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'OpenAPI generation failed.'}\n`,
  );
  process.exitCode = 1;
});
