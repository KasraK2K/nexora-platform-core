import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { environmentSchema } from '../src/config/environment.schema';

const projectRoot = resolve(__dirname, '..');
const runbook = readFileSync(
  resolve(projectRoot, 'docs/operations/production-runbook.md'),
  'utf8',
);
const example = readFileSync(
  resolve(projectRoot, '.env.production.example'),
  'utf8',
);

const headings = [
  'Deployment',
  'Rollback',
  'Backup and restore drill',
  'Secret rotation',
  'Incident response',
  'Retention, deletion, and privacy',
  'Objectives, capacity, quotas, and alerts',
];
const missingHeadings = headings.filter(
  (heading) => !runbook.includes(`## ${heading}`),
);
const configKeys = Object.keys(environmentSchema.shape);

if (configKeys.length === 0) {
  process.stderr.write(
    'Operations documentation check failed. The environment schema contains no configuration keys.\n',
  );
  process.exitCode = 1;
} else {
  const missingKeys = configKeys.filter(
    (key) => !example.includes(`${key}=`) || !runbook.includes(`\`${key}\``),
  );

  if (missingHeadings.length || missingKeys.length) {
    process.stderr.write(
      `Operations documentation check failed. Missing headings: ${missingHeadings.join(', ') || 'none'}. Missing configuration keys: ${missingKeys.join(', ') || 'none'}.\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Operations documentation check passed (${headings.length} sections, ${configKeys.length} configuration keys).\n`,
    );
  }
}
