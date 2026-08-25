import { readFileSync } from 'node:fs';

const runbook = readFileSync(
  new URL('../docs/operations/production-runbook.md', import.meta.url),
  'utf8',
);
const configSource = readFileSync(
  new URL('../src/config/app-config.ts', import.meta.url),
  'utf8',
);
const example = readFileSync(
  new URL('../.env.production.example', import.meta.url),
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
const configKeys = [...configSource.matchAll(/^\s{4}([A-Z][A-Z0-9_]+):/gm)].map(
  (match) => match[1],
);
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
