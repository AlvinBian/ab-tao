#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from './security-validator.mjs';
import { needsSync, readVersions, recordSync } from './version-tracker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = path.resolve(__dirname, '../resources/ai/sources');

const SOURCES_CONFIG = {
  ecc: {
    url: 'https://github.com/affaan-m/everything-claude-code.git',
    type: 'ai',
    // Only validate resource directories, not docs/examples/research
    validatePaths: ['commands', 'agents', 'rules', 'skills', 'hooks'],
  },
  anthropic: {
    url: 'https://github.com/anthropics/skills.git',
    type: 'ai',
    validatePaths: ['skills'],
  },
  letta: {
    url: 'https://github.com/letta-ai/skills.git',
    type: 'ai',
  },
  'context-engineering': {
    url: 'https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering.git',
    type: 'ai',
  },
};

function getRemoteHead(url) {
  try {
    const output = execSync(`git ls-remote ${url} HEAD`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    return output.split('\t')[0].trim();
  } catch {
    return null;
  }
}

async function syncSource(sourceName, config, options = {}) {
  const targetPath = path.join(RESOURCES_PATH, sourceName);

  // Check version lock
  const versions = readVersions();
  if (versions[sourceName]?.locked) {
    console.log(`  Locked, skipping ${sourceName}`);
    return { skipped: true, reason: 'locked' };
  }

  // Check if sync is needed
  if (!options.force) {
    const remoteSha = getRemoteHead(config.url);
    if (remoteSha && !needsSync(sourceName, remoteSha)) {
      console.log(`  Up to date, skipping ${sourceName}`);
      return { skipped: true, reason: 'up-to-date' };
    }
  }

  if (options.dryRun) {
    console.log(`  [dry-run] Would sync ${sourceName} from ${config.url}`);
    return { dryRun: true };
  }

  // Use secure temp directory
  const tempDir = await mkdtemp(path.join(tmpdir(), `ab-tao-sync-${sourceName}-`));

  try {
    // Clone
    execSync(`git clone --depth 1 ${config.url} ${tempDir}`, {
      stdio: 'pipe',
      timeout: 60000,
    });

    // Get commit SHA
    const sha = execSync('git rev-parse HEAD', {
      cwd: tempDir,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    // Remove .git from cloned content
    fs.rmSync(path.join(tempDir, '.git'), { recursive: true, force: true });

    // Security validation — only validate resource directories if specified
    const pathsToValidate = config.validatePaths || [];
    if (pathsToValidate.length > 0) {
      // Validate only the specified subdirectories
      for (const subDir of pathsToValidate) {
        const subPath = path.join(tempDir, subDir);
        if (!fs.existsSync(subPath)) continue;
        const { ok, summary } = await validateContent(subPath);
        if (!ok) {
          throw new Error(
            `Security validation failed for ${sourceName}/${subDir}: ${summary.errors.map((e) => e.message).join(', ')}`,
          );
        }
      }
    } else {
      // Validate entire directory
      const { ok, summary } = await validateContent(tempDir);
      if (!ok) {
        throw new Error(
          `Security validation failed for ${sourceName}: ${summary.errors.map((e) => e.message).join(', ')}`,
        );
      }
    }

    // Atomic swap: backup → replace → cleanup
    const backupPath = `${targetPath}.bak`;

    if (fs.existsSync(targetPath)) {
      fs.renameSync(targetPath, backupPath);
    }

    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(tempDir, targetPath, { recursive: true });

      // Record version
      recordSync(sourceName, sha);

      // Cleanup backup
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    } catch (err) {
      // Rollback on failure
      if (fs.existsSync(backupPath)) {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.renameSync(backupPath, targetPath);
      }
      throw err;
    }

    return { success: true, sha };
  } finally {
    // Always cleanup temp
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function syncAll(options = {}) {
  console.log('Syncing all external sources...\n');

  const results = [];
  for (const [name, config] of Object.entries(SOURCES_CONFIG)) {
    console.log(`[${name}]`);
    try {
      const result = await syncSource(name, config, options);
      results.push({ source: name, ...result });
      if (result.success) {
        console.log(`  Synced (${result.sha.slice(0, 8)})`);
      }
    } catch (err) {
      results.push({ source: name, success: false, error: err.message });
      console.error(`  Failed: ${err.message}`);
    }
    console.log();
  }

  const succeeded = results.filter((r) => r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => r.success === false).length;
  console.log(`Done: ${succeeded} synced, ${skipped} skipped, ${failed} failed`);

  return results;
}

// CLI entry point
const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

if (args.includes('--source')) {
  const idx = args.indexOf('--source');
  const sourceName = args[idx + 1];
  if (!SOURCES_CONFIG[sourceName]) {
    console.error(`Unknown source: ${sourceName}`);
    console.error(`Available: ${Object.keys(SOURCES_CONFIG).join(', ')}`);
    process.exit(1);
  }
  syncSource(sourceName, SOURCES_CONFIG[sourceName], { force, dryRun }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  syncAll({ force, dryRun }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { SOURCES_CONFIG, syncAll, syncSource };
