/**
 * Phase: 安裝計畫展示 + 確認/調整/精簡
 *
 * 用 p.log.info 展示完整安裝計畫，讓用戶選擇安裝方式：
 *   - 安裝全部（直接執行）
 *   - 逐項確認（展開 detailConfirm 子流程）
 *   - 精簡安裝（只裝核心必需品）
 *   - 上一步（返回 BACK symbol）
 */

import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { cloneDeep } from 'lodash-es';
import { buildPlanSummary } from '../cli/plan-view.mjs';
import { BACK, handleCancel, smartSelect } from '../cli/prompts.mjs';
import { generateMinimalPlan } from '../config/auto-plan.mjs';

/**
 * 展示安裝計畫並讓用戶確認
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @returns {Object|symbol} 確認的 plan（可能被「精簡」修改）/ BACK / null（取消）
 */
export async function phasePlan(plan) {
  // 偵測現有安裝狀態
  const HOME = process.env.HOME;
  const claudeDir = path.join(HOME, '.claude');
  const readDir = (dir) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => f.replace('.md', ''))
      : [];
  const existing = {
    commands: readDir(path.join(claudeDir, 'commands')),
    agents: readDir(path.join(claudeDir, 'agents')),
    rules: readDir(path.join(claudeDir, 'rules')),
    hasSettings: fs.existsSync(path.join(claudeDir, 'settings.json')),
    hasHooks: fs.existsSync(path.join(claudeDir, 'hooks.json')),
  };

  // 組裝計畫摘要
  const summary = buildPlanSummary(plan, existing, HOME, claudeDir);
  p.log.info(`安裝計畫\n${summary}`);

  // 選擇
  const action = handleCancel(
    await p.select({
      message: '安裝方式',
      options: [
        { value: 'full', label: '✅ 安裝全部', hint: '推薦' },
        { value: 'detail', label: '📋 逐項確認', hint: '展開各類別的選擇' },
        {
          value: 'minimal',
          label: '⚡ 精簡安裝',
          hint: '只裝核心必需品（code-review + pr-workflow + coder + reviewer + debugger）',
        },
        { value: 'back', label: '← 上一步' },
      ],
    }),
  );

  if (action === BACK || action === 'back') return BACK;
  if (action === 'minimal') return generateMinimalPlan(plan);
  if (action === 'detail') return await detailConfirm(plan);
  return plan; // full
}

/**
 * 逐項確認子流程
 *
 * 讓用戶逐步調整計畫中的各個項目：
 *   1. 調整各 repo 的角色（main/temp）
 *   2. 選擇全局 commands / agents / rules
 *   3. 選擇 AI 外部資源
 *   4. 選擇 ZSH 模組
 *
 * @param {Object} originalPlan - 原始計畫（不直接修改，使用 cloneDeep 複製）
 * @returns {Promise<Object|symbol>} 調整後的計畫，或 BACK symbol
 */
async function detailConfirm(originalPlan) {
  // _pipelineResult 含 Map 物件，cloneDeep 會損壞 Map，先取出再還原
  const savedPipelineResult = originalPlan._pipelineResult;
  const savedFetchedSources = originalPlan._fetchedSources;
  // 深拷貝避免 BACK 時污染 cache 中的原始 plan
  const plan = cloneDeep(originalPlan);
  plan._pipelineResult = savedPipelineResult;
  plan._fetchedSources = savedFetchedSources;
  // 1. Repo 角色調整
  const roleItems = plan.repos.map((r) => ({
    value: r.fullName,
    label: `${r.role === 'main' ? '⭐' : '🔄'} ${r.fullName.split('/')[1]}`,
    hint: r.role === 'main' ? '主力（完整配置）' : '臨時（精簡配置）',
  }));
  const mainRepos = await smartSelect({
    title: '⭐ 主力 repos（完整配置）',
    items: roleItems,
    preselected: plan.repos.filter((r) => r.role === 'main').map((r) => r.fullName),
    required: true,
    autoSelectThreshold: 0,
  });
  if (mainRepos === BACK) return BACK;

  // 更新角色
  const mainSet = new Set(mainRepos);
  for (const r of plan.repos) {
    if (mainSet.has(r.fullName)) {
      r.role = 'main';
    } else if (r.role !== 'tool') {
      r.role = 'temp';
    }
    // tool repos keep their role unchanged
  }

  // 2-5. 全局 commands/agents/rules/hooks（各一個 smartSelect）
  const globalSelections = [
    { key: 'commands', title: '📟 全局 Commands', pool: plan.global.commands },
    { key: 'agents', title: '🤖 全局 Agents', pool: plan.global.agents },
    { key: 'rules', title: '📐 全局 Rules', pool: plan.global.rules },
  ];

  for (const sel of globalSelections) {
    const items = sel.pool.map((name) => ({
      value: name,
      label: name,
      hint: '',
    }));
    const selected = await smartSelect({
      title: sel.title,
      items,
      preselected: sel.pool,
      autoSelectThreshold: 0,
    });
    if (selected === BACK) return BACK;
    plan.global[sel.key] = selected;
  }

  // 6. 技術棧（如果 pipeline 有 tech-select 邏輯，這裡直接用預選）
  // 7. ECC 選擇
  if (plan.ecc.length > 0) {
    const eccItems = plan.ecc.map((name) => ({
      value: name,
      label: name,
      hint: '',
    }));
    const selectedEcc = await smartSelect({
      title: '🌐 AI 外部資源',
      items: eccItems,
      preselected: plan.ecc,
      autoSelectThreshold: 0,
    });
    if (selectedEcc === BACK) return BACK;
    plan.ecc = selectedEcc;
  }

  // 8. ZSH 模組
  if (plan.zshModules.length > 0) {
    const zshItems = plan.zshModules.map((name) => ({
      value: name,
      label: name,
      hint: '',
    }));
    const selectedZsh = await smartSelect({
      title: '🐚 ZSH 模組',
      items: zshItems,
      preselected: plan.zshModules,
      autoSelectThreshold: 0,
    });
    if (selectedZsh === BACK) return BACK;
    plan.zshModules = selectedZsh;
  }

  return plan;
}
