#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from './security-validator.mjs';
import { readVersions } from './version-tracker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = path.resolve(__dirname, '../resources/ai/sources');

const EXPECTED_STRUCTURES = {
  ecc: {
    required: ['commands', 'agents', 'rules'],
    format: 'ecc',
  },
  superpowers: { required: [], format: 'agent-skills' },
  anthropic: { required: [], format: 'agent-skills' },
  letta: { required: [], format: 'agent-skills' },
  'context-engineering': { required: [], format: 'agent-skills' },
};

function validateSourceStructure(sourceName, sourcePath) {
  const errors = [];
  const config = EXPECTED_STRUCTURES[sourceName];

  if (!config) {
    errors.push(`Unknown source: ${sourceName}`);
    return errors;
  }

  if (!fs.existsSync(sourcePath)) {
    errors.push(`Source directory missing: ${sourcePath}`);
    return errors;
  }

  // Check required subdirectories
  for (const dir of config.required) {
    const dirPath = path.join(sourcePath, dir);
    if (!fs.existsSync(dirPath)) {
      errors.push(`Missing required directory: ${sourceName}/${dir}`);
    }
  }

  // Format-specific checks
  if (config.format === 'agent-skills') {
    const items = fs.readdirSync(sourcePath);
    const hasSkills = items.some((item) => {
      const itemPath = path.join(sourcePath, item);
      return (
        fs.statSync(itemPath).isDirectory() && fs.existsSync(path.join(itemPath, 'SKILL.md'))
      );
    });

    // Agent-skills format may not always have SKILL.md — just warn
    if (!hasSkills && items.length > 0) {
      console.warn(`  Warning: No SKILL.md found in ${sourceName} (may be expected)`);
    }
  }

  return errors;
}

async function validateAll() {
  console.log('Validating resource structure...\n');

  const versions = readVersions();
  let totalErrors = 0;

  for (const sourceName of Object.keys(EXPECTED_STRUCTURES)) {
    const sourcePath = path.join(RESOURCES_PATH, sourceName);

    if (!fs.existsSync(sourcePath)) {
      console.log(`[${sourceName}] Not synced yet, skipping`);
      continue;
    }

    console.log(`[${sourceName}]`);

    // Structure check
    const structErrors = validateSourceStructure(sourceName, sourcePath);
    for (const err of structErrors) {
      console.error(`  Structure: ${err}`);
    }

    // Security check
    const { ok, summary } = await validateContent(sourcePath);
    if (!ok) {
      for (const err of summary.errors) {
        console.error(`  Security [${err.code}]: ${err.file} — ${err.message}`);
      }
    }

    const sourceErrors = structErrors.length + (ok ? 0 : summary.errors.length);
    if (sourceErrors === 0) {
      const version = versions[sourceName];
      const sha = version?.sha ? version.sha.slice(0, 8) : 'unknown';
      console.log(`  OK (${summary.total} files, SHA: ${sha})`);
    }

    totalErrors += sourceErrors;
    console.log();
  }

  if (totalErrors > 0) {
    console.error(`Validation failed with ${totalErrors} errors`);
    process.exit(1);
  }

  console.log('All validations passed');
}

validateAll().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
