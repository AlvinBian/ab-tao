<script setup lang="ts">
// Requires: Vue 3.x / Element Plus

import { ref } from "vue";
import type { SectionTabConfig } from "@/components/SectionTabs.vue";
import SectionTabs from "@/components/SectionTabs.vue";

// ── 型別定義 ─────────────────────────────────────────────────────────────────

interface IntentMapping {
	intent: string;
	command: string;
	hits: number;
}

interface ProfileItem {
	name: string;
	label: string;
	active: boolean;
}

interface FailurePattern {
	id: number;
	pattern: string;
	category: string;
}

interface FederatedProject {
	name: string;
	path: string;
	lastUpdated: string;
}

// ── Tab 設定 ─────────────────────────────────────────────────────────────────

const tabs: SectionTabConfig[] = [
	{ key: "dispatcher", label: "Dispatcher" },
	{ key: "profiles", label: "Profiles" },
	{ key: "failure-patterns", label: "Failure Patterns" },
	{ key: "federated-memory", label: "Federated Memory" },
];

// ── Tab 1: Dispatcher mock data ───────────────────────────────────────────────

const intentMappings: IntentMapping[] = [
	{ intent: "PR review", command: "/verify", hits: 42 },
	{ intent: "釐清需求", command: "/specify", hits: 31 },
	{ intent: "TDD 流程", command: "/chain-tdd", hits: 18 },
	{ intent: "切 profile", command: "d:profile", hits: 27 },
	{ intent: "build 壞了", command: "/check", hits: 55 },
	{ intent: "發 Slack", command: "/slack", hits: 14 },
];

// ── Tab 2: Profiles mock data ─────────────────────────────────────────────────

const profiles = ref<ProfileItem[]>([
	{ name: "personal", label: "Personal", active: false },
	{ name: "work", label: "Work", active: true },
	{ name: "oss", label: "OSS", active: false },
	{ name: "day-to-day", label: "Day-to-Day", active: false },
	{ name: "spike", label: "Spike", active: false },
	{ name: "production", label: "Production", active: false },
	{ name: "frugal", label: "Frugal", active: false },
]);

const switchPrompt = ref<string | null>(null);

function handleSwitchProfile(profileName: string): void {
	switchPrompt.value = `pnpm run d:profile ${profileName}`;
}

// ── Tab 3: Failure Patterns mock data ─────────────────────────────────────────

const failurePatterns: FailurePattern[] = [
	{
		id: 1,
		pattern: "連續 3 次相同方向失敗未停下診斷",
		category: "Loop 偵測",
	},
	{
		id: 2,
		pattern: "未確認版本即輸出版本特定 API",
		category: "假設顯式化",
	},
	{
		id: 3,
		pattern: "靜默擴大 PR 範圍（超出原始 spec）",
		category: "範圍漂移",
	},
	{
		id: 4,
		pattern: "工具輸出 empty/error 後盲推下一步",
		category: "漸進驗證",
	},
	{
		id: 5,
		pattern: "交付含未說出前提的半成品",
		category: "半成品禁止",
	},
];

// ── Tab 4: Federated Memory mock data ────────────────────────────────────────

const federatedProjects: FederatedProject[] = [
	{
		name: "kkday-email-mjml",
		path: "/Users/alvin/ab-projects/kkday-email-mjml/memory/MEMORY.md",
		lastUpdated: "2026-04-25",
	},
	{
		name: "ab-tao",
		path: "/Users/alvin/ab-projects/ab-tao/memory/MEMORY.md",
		lastUpdated: "2026-04-27",
	},
	{
		name: "global",
		path: "~/.claude/memory/MEMORY.md",
		lastUpdated: "2026-04-27",
	},
];
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="dispatcher">
    <!-- ── Tab 1: Dispatcher ────────────────────────────────────────────────── -->
    <template #dispatcher>
      <div class="ai-section-tab">
        <div class="tab-header">
          <h3 class="tab-title">意圖 Dispatcher</h3>
          <p class="tab-desc">
            intent-cache.json 意圖映射表（mock）：展示常用意圖與對應命令的命中次數。
          </p>
        </div>
        <el-table :data="intentMappings" stripe style="width: 100%">
          <el-table-column prop="intent" label="意圖" min-width="160" />
          <el-table-column prop="command" label="映射命令" min-width="140">
            <template #default="{ row }">
              <el-tag type="primary" size="small">{{ row.command }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="hits" label="命中次數" min-width="100">
            <template #default="{ row }">
              <el-badge :value="row.hits" type="info" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- ── Tab 2: Profiles ─────────────────────────────────────────────────── -->
    <template #profiles>
      <div class="ai-section-tab">
        <div class="tab-header">
          <h3 class="tab-title">Profiles</h3>
          <p class="tab-desc">
            7 個可用 profile，綠色高亮為當前 active profile。點擊「切換」取得對應指令。
          </p>
        </div>
        <div class="profiles-grid">
          <el-card
            v-for="profile in profiles"
            :key="profile.name"
            :class="['profile-card', { 'profile-card--active': profile.active }]"
            shadow="hover"
          >
            <div class="profile-card-content">
              <span class="profile-name">{{ profile.label }}</span>
              <el-tag
                v-if="profile.active"
                type="success"
                size="small"
                effect="dark"
              >
                active
              </el-tag>
              <el-tag
                v-else
                type="info"
                size="small"
                effect="plain"
              >
                inactive
              </el-tag>
            </div>
            <el-button
              size="small"
              type="primary"
              plain
              style="margin-top: 8px; width: 100%"
              @click="handleSwitchProfile(profile.name)"
            >
              切換
            </el-button>
          </el-card>
        </div>
        <el-alert
          v-if="switchPrompt"
          :title="`執行指令：${switchPrompt}`"
          type="info"
          show-icon
          closable
          style="margin-top: 16px"
          @close="switchPrompt = null"
        />
      </div>
    </template>

    <!-- ── Tab 3: Failure Patterns ─────────────────────────────────────────── -->
    <template #failure-patterns>
      <div class="ai-section-tab">
        <div class="tab-header">
          <h3 class="tab-title">Failure Patterns</h3>
          <p class="tab-desc">
            failure-patterns.md mock 內容（append-only，每月 dedupe）。
          </p>
        </div>
        <el-timeline>
          <el-timeline-item
            v-for="item in failurePatterns"
            :key="item.id"
            :timestamp="item.category"
            placement="top"
            type="danger"
          >
            <el-card shadow="never">
              <p class="pattern-text">{{ item.pattern }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </template>

    <!-- ── Tab 4: Federated Memory ─────────────────────────────────────────── -->
    <template #federated-memory>
      <div class="ai-section-tab">
        <div class="tab-header">
          <h3 class="tab-title">Federated Memory</h3>
          <p class="tab-desc">
            projects.json mock 數據：跨 project 的 memory 索引。
          </p>
        </div>
        <el-table :data="federatedProjects" stripe style="width: 100%">
          <el-table-column prop="name" label="Project" min-width="160">
            <template #default="{ row }">
              <strong>{{ row.name }}</strong>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="Memory Path" min-width="320">
            <template #default="{ row }">
              <el-text type="info" size="small" truncated>{{ row.path }}</el-text>
            </template>
          </el-table-column>
          <el-table-column prop="lastUpdated" label="Last Updated" min-width="120" />
        </el-table>
      </div>
    </template>
  </SectionTabs>
</template>

<style scoped>
.ai-section-tab {
  padding: 8px 0;
}

.tab-header {
  margin-bottom: 20px;
}

.tab-title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tab-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
}

.profiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.profile-card {
  transition: border-color 0.2s;
}

.profile-card--active {
  border-color: var(--el-color-success);
}

.profile-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.profile-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.pattern-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--el-text-color-primary);
}
</style>
