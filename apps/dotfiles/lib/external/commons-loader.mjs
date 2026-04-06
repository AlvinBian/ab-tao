/**
 * Commons 資源載入器
 *
 * 掃描 @ab-tao/commons 已同步的所有 AI 來源（7 個），
 * 將 commands/agents/rules/skills 統一載入供 pipeline 使用。
 */

import fs from 'node:fs';
import path from 'node:path';
import { RESOURCES_DIR } from '@ab-tao/commons/paths';

/**
 * 從目錄中載入所有 .md 檔案
 * @returns {{ name: string, content: string }[]}
 */
function loadMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({
      name: f,
      content: fs.readFileSync(path.join(dir, f), 'utf8'),
    }));
}

/**
 * 從單一 source 目錄載入所有資源
 * @param {string} sourceName - 來源名稱（如 'ecc', 'anthropic'）
 * @returns {{ name: string, commands: array, agents: array, rules: array, skills: array } | null}
 */
function loadSource(sourceName) {
  const sourceDir = path.join(RESOURCES_DIR, sourceName);
  if (!fs.existsSync(sourceDir)) return null;

  const result = {
    name: sourceName,
    commands: loadMdFiles(path.join(sourceDir, 'commands')),
    agents: loadMdFiles(path.join(sourceDir, 'agents')),
    rules: loadMdFiles(path.join(sourceDir, 'rules')),
    skills: [],
  };

  // 掃描 skills 目錄（SKILL.md 格式）
  const skillsDir = path.join(sourceDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        result.skills.push({
          name: entry.name,
          content: fs.readFileSync(skillMd, 'utf8'),
        });
      }
    }
  }

  return result;
}

/**
 * 載入 commons 中所有已同步的 AI 來源
 * @returns {{ sources: object[], stats: { total: number, loaded: number, resources: number } }}
 */
export function loadAllCommonsResources() {
  if (!fs.existsSync(RESOURCES_DIR)) {
    return { sources: [], stats: { total: 0, loaded: 0, resources: 0 } };
  }

  const entries = fs.readdirSync(RESOURCES_DIR, { withFileTypes: true });
  const sources = [];
  let totalResources = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const source = loadSource(entry.name);
    if (!source) continue;

    const count =
      source.commands.length + source.agents.length + source.rules.length + source.skills.length;
    if (count > 0) {
      sources.push(source);
      totalResources += count;
    }
  }

  return {
    sources,
    stats: {
      total: entries.filter((e) => e.isDirectory()).length,
      loaded: sources.length,
      resources: totalResources,
    },
  };
}
