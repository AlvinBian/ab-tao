<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

// biome-ignore lint/correctness/noUnusedVariables: used in template
const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";
// biome-ignore lint/correctness/noUnusedVariables: used in template
const loading = computed(() => store.loading);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const overview = computed(() => store.data?.overview);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const skills = computed(() => store.data?.skills ?? []);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const plugins = computed(() => store.data?.plugins ?? []);

const consoleTechs = [
	"Vue 3.5",
	"TypeScript",
	"Element Plus",
	"ECharts 5",
	"Pinia",
	"Vite 6",
];
const apiTechs = ["Node.js 18+", "原生 http（零依賴）", "SSE 串流"];
const cliTechs = ["pnpm workspace", "@clack/prompts", "Biome"];

// biome-ignore lint/correctness/noUnusedVariables: used in template
const techGroups = [
	{
		label: "Console（前端）",
		items: consoleTechs,
		tagType: "primary" as const,
	},
	{ label: "API Server", items: apiTechs, tagType: "success" as const },
	{ label: "CLI 工具", items: cliTechs, tagType: "warning" as const },
];

// biome-ignore lint/correctness/noUnusedVariables: used in template
const archText = `apps/console/   — Vue 3 後台控制台（GUI 管理）
apps/dotfiles/  — CLI 工具（d:setup / d:scan / d:status 等）
packages/commons/ — AI 資源池（同步、驗證、提供 API）
packages/share/   — 共用工具庫（utils/libs）`;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const commands = [
	{ cmd: "pnpm run d:setup", desc: "互動式環境部署（5 階段精靈）" },
	{ cmd: "pnpm run d:scan", desc: "技術棧掃描 & stacks/ 生成" },
	{ cmd: "pnpm run d:status", desc: "配置儀表板與健康度報告" },
	{ cmd: "pnpm run d:restore", desc: "還原備份（Claude 配置 / ZSH）" },
	{ cmd: "pnpm run d:hooks", desc: "Hook 管理（啟停 / 部署）" },
	{ cmd: "pnpm run d:prefs-sync", desc: "iCloud 偏好檔同步" },
	{ cmd: "pnpm run cs:dev", desc: "啟動後台控制台（Vite + API）" },
	{ cmd: "pnpm run cs:open", desc: "構建後以 file:// 開啟（離線）" },
];

// biome-ignore lint/correctness/noUnusedVariables: used in template
const protectionItems = [
	{
		title: "permissions.allow（preserve）",
		content:
			"安裝時保留用戶已加入的 allow patterns，僅追加，不覆蓋。確保用戶個人化的寬鬆規則不被重置。",
	},
	{
		title: "permissions.deny（union）",
		content:
			"新舊 deny patterns 取聯集合並，雙向保護。ab-tao 的安全規則與用戶已加入的規則共存，任何一方都不會被清除。",
	},
	{
		title: "hooks（dedup）",
		content:
			"以 entry.id 去重複，重複安裝不會產生重複 hook entries。每次 d:setup 可安全重跑。",
	},
];
</script>

<template>
  <div style="padding: 24px; max-width: 860px">
    <!-- 現有系統資訊 -->
    <el-descriptions title="ab-tao Console" :column="2" border>
      <el-descriptions-item label="版本">
        <el-tag type="info">{{ appVersion }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="健康度">
        <el-progress
          v-if="overview"
          :percentage="overview.healthPct"
          :status="overview.healthPct >= 80 ? 'success' : overview.healthPct >= 50 ? 'warning' : 'exception'"
          style="width: 200px"
        />
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="Skills 安裝數">
        {{ skills.length }}
      </el-descriptions-item>
      <el-descriptions-item label="Plugins 安裝數">
        {{ plugins.length }}
      </el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <el-skeleton v-if="loading" :rows="4" animated />
    <el-empty v-else-if="!overview" description="無法取得狀態資訊" />
    <el-descriptions v-else title="系統資訊" :column="2" border>
      <el-descriptions-item label="已安裝總計">{{ overview.totalInstalled }}</el-descriptions-item>
      <el-descriptions-item label="已使用總計">{{ overview.totalUsed }}</el-descriptions-item>
      <el-descriptions-item label="指令使用率">{{ (overview.commandUsageRate * 100).toFixed(1) }}%</el-descriptions-item>
      <el-descriptions-item label="Agent 使用率">{{ (overview.agentUsageRate * 100).toFixed(1) }}%</el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <!-- 1. 專案介紹 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header><span style="font-weight: 600">專案介紹</span></template>
      <p style="margin: 0 0 8px; line-height: 1.7">
        <strong>ab-tao</strong> 是一套開發環境統一管理工具，核心理念為：
        從 <code>commons</code> 資源池同步 AI 工具資源 →
        <code>dotfiles</code> 依技術棧篩選 →
        只安裝匹配當前環境的配置。
      </p>
      <p style="margin: 0 0 8px; line-height: 1.7">
        <strong>部署目標</strong>：<code>~/.claude/</code>（Claude Code 配置）、
        <code>~/</code>（ZSH 環境）。
      </p>
      <p style="margin: 0; line-height: 1.7">
        <strong>Console</strong> 是 ab-tao 的 Web 後台控制台，提供 GUI 介面管理所有
        CLI 指令的執行、配置檢視與 Hook 管理。
      </p>
    </el-card>

    <!-- 2. 技術棧 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header><span style="font-weight: 600">技術棧</span></template>
      <div v-for="group in techGroups" :key="group.label" style="margin-bottom: 12px">
        <div style="font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 6px">
          {{ group.label }}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px">
          <el-tag
            v-for="tech in group.items"
            :key="tech"
            :type="group.tagType"
            size="small"
            effect="plain"
          >{{ tech }}</el-tag>
        </div>
      </div>
    </el-card>

    <!-- 3. 架構說明 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header><span style="font-weight: 600">架構說明</span></template>
      <pre style="margin: 0; font-size: 12px; line-height: 1.8; background: var(--el-fill-color-dark); padding: 12px; border-radius: 4px; overflow-x: auto; color: var(--el-text-color-regular)">{{ archText }}</pre>
      <p style="margin: 8px 0 0; font-size: 12px; color: var(--el-text-color-secondary)">
        職責分離：commons 只同步資源 → dotfiles 按技術棧篩選 → 只安裝匹配的。
      </p>
    </el-card>

    <!-- 4. 主要指令速查 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header><span style="font-weight: 600">主要指令速查</span></template>
      <el-table :data="commands" size="small" style="width: 100%">
        <el-table-column label="指令" width="260">
          <template #default="{ row }">
            <code style="font-size: 12px; color: var(--el-color-primary)">{{ row.cmd }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="說明" />
      </el-table>
    </el-card>

    <!-- 5. 配置保護策略 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header><span style="font-weight: 600">配置保護策略</span></template>
      <el-descriptions :column="1" border>
        <el-descriptions-item
          v-for="item in protectionItems"
          :key="item.title"
          :label="item.title"
          label-class-name="protection-label"
        >
          <span style="font-size: 13px; color: var(--el-text-color-regular)">{{ item.content }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 6. 連結 / 聯絡 -->
    <el-card shadow="never">
      <template #header><span style="font-weight: 600">連結 / 聯絡</span></template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="GitHub">
          <el-link
            href="https://github.com/alvin-bian/ab-tao"
            target="_blank"
            type="primary"
          >github.com/alvin-bian/ab-tao</el-link>
        </el-descriptions-item>
        <el-descriptions-item label="維護者">
          alvin.bian@kkday.com
        </el-descriptions-item>
        <el-descriptions-item label="版本">
          <el-tag size="small">{{ appVersion }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="CHANGELOG">
          <code style="font-size: 12px">apps/console/CHANGELOG.md</code>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>
