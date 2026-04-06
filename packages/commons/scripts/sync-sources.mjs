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
    // 僅驗證資源目錄，跳過 docs/examples/research
    validatePaths: ['commands', 'agents', 'rules', 'skills'],
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

  // 檢查版本鎖定
  const versions = readVersions();
  if (versions[sourceName]?.locked) {
    console.log(`  已鎖定，跳過 ${sourceName}`);
    return { skipped: true, reason: 'locked' };
  }

  // 檢查是否需要同步
  if (!options.force) {
    const remoteSha = getRemoteHead(config.url);
    if (remoteSha && !needsSync(sourceName, remoteSha)) {
      console.log(`  已是最新，跳過 ${sourceName}`);
      return { skipped: true, reason: 'up-to-date' };
    }
  }

  if (options.dryRun) {
    console.log(`  [模擬] 將從 ${config.url} 同步 ${sourceName}`);
    return { dryRun: true };
  }

  // 使用安全暫存目錄
  const tempDir = await mkdtemp(path.join(tmpdir(), `ab-tao-sync-${sourceName}-`));

  try {
    // 克隆
    execSync(`git clone --depth 1 ${config.url} ${tempDir}`, {
      stdio: 'pipe',
      timeout: 60000,
    });

    // 取得 commit SHA
    const sha = execSync('git rev-parse HEAD', {
      cwd: tempDir,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    // 移除克隆的 .git
    fs.rmSync(path.join(tempDir, '.git'), { recursive: true, force: true });

    // 安全驗證 — 僅驗證指定的資源子目錄
    const pathsToValidate = config.validatePaths || [];
    if (pathsToValidate.length > 0) {
      for (const subDir of pathsToValidate) {
        const subPath = path.join(tempDir, subDir);
        if (!fs.existsSync(subPath)) continue;
        const { ok, summary } = await validateContent(subPath);
        if (!ok) {
          throw new Error(
            `${sourceName}/${subDir} 安全驗證失敗: ${summary.errors.map((e) => e.message).join(', ')}`,
          );
        }
      }
    } else {
      const { ok, summary } = await validateContent(tempDir);
      if (!ok) {
        throw new Error(
          `${sourceName} 安全驗證失敗: ${summary.errors.map((e) => e.message).join(', ')}`,
        );
      }
    }

    // 原子替換：備份 → 替換 → 清理
    const backupPath = `${targetPath}.bak`;

    if (fs.existsSync(targetPath)) {
      fs.renameSync(targetPath, backupPath);
    }

    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(tempDir, targetPath, { recursive: true });

      // 記錄版本
      recordSync(sourceName, sha);

      // 清理備份
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    } catch (err) {
      // 失敗時回滾
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
    // 始終清理暫存目錄
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function syncAll(options = {}) {
  console.log('正在同步所有外部資源...\n');

  const results = [];
  for (const [name, config] of Object.entries(SOURCES_CONFIG)) {
    console.log(`[${name}]`);
    try {
      const result = await syncSource(name, config, options);
      results.push({ source: name, ...result });
      if (result.success) {
        console.log(`  已同步 (${result.sha.slice(0, 8)})`);
      }
    } catch (err) {
      results.push({ source: name, success: false, error: err.message });
      console.error(`  失敗: ${err.message}`);
    }
    console.log();
  }

  const succeeded = results.filter((r) => r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => r.success === false).length;
  console.log(`完成: ${succeeded} 已同步, ${skipped} 已跳過, ${failed} 失敗`);

  return results;
}

// CLI 入口
const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

if (args.includes('--source')) {
  const idx = args.indexOf('--source');
  const sourceName = args[idx + 1];
  if (!SOURCES_CONFIG[sourceName]) {
    console.error(`未知的來源: ${sourceName}`);
    console.error(`可用來源: ${Object.keys(SOURCES_CONFIG).join(', ')}`);
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
