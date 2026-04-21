<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { formatRelative } from "@/composables/useFormatRelative";

// ── 型別 ──────────────────────────────────────────────────────────────
interface EnrichedRepo {
	name: string;
	path: string;
	role: "main" | "temp" | "archived";
	techStacks: string[];
	branch: string | null;
	lastCommit: string | null;
}

// ── 工具函式 ──────────────────────────────────────────────────────────
const isEmpty = (d: unknown): boolean =>
	d == null ||
	(Array.isArray(d) && d.length === 0) ||
	(typeof d === "object" &&
		!Array.isArray(d) &&
		Object.keys(d as object).length === 0);

// ── 狀態 ──────────────────────────────────────────────────────────────
const repos = ref<EnrichedRepo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const timestamp = ref<string | null>(null);
const searchQuery = ref("");
const scanningRepos = ref<Set<string>>(new Set());

// ── 資料擷取 ──────────────────────────────────────────────────────────
async function fetchRepos(): Promise<void> {
	loading.value = true;
	error.value = null;
	try {
		const res = await fetch("/api/repos");
		const json = await res.json();
		if (json.code === 0) {
			repos.value = json.data as EnrichedRepo[];
			timestamp.value = new Date().toISOString();
		} else {
			error.value = json.message as string;
		}
	} catch (e) {
		error.value = e instanceof Error ? e.message : "連線失敗";
	} finally {
		loading.value = false;
	}
}

onMounted(fetchRepos);

// ── 過濾後分組 ────────────────────────────────────────────────────────
const filteredRepos = computed<EnrichedRepo[]>(() => {
	const q = searchQuery.value.toLowerCase();
	if (!q) return repos.value;
	return repos.value.filter(
		(r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
	);
});

interface RoleGroup {
	role: "main" | "temp" | "archived";
	label: string;
	items: EnrichedRepo[];
}

const roleGroups = computed<RoleGroup[]>(() => {
	const groups: Record<"main" | "temp" | "archived", EnrichedRepo[]> = {
		main: [],
		temp: [],
		archived: [],
	};
	for (const repo of filteredRepos.value) {
		const key = repo.role in groups ? repo.role : "temp";
		groups[key].push(repo);
	}
	return (
		[
			{ role: "main" as const, label: "主要專案" },
			{ role: "temp" as const, label: "暫存專案" },
			{ role: "archived" as const, label: "已歸檔" },
		] as { role: "main" | "temp" | "archived"; label: string }[]
	)
		.map(({ role, label }) => ({ role, label, items: groups[role] }))
		.filter((g) => g.items.length > 0);
});

const activeCollapse = ref<string[]>(["main"]);

// ── 動作 ──────────────────────────────────────────────────────────────
async function scanRepo(name: string): Promise<void> {
	if (scanningRepos.value.has(name)) return;
	scanningRepos.value = new Set([...scanningRepos.value, name]);
	try {
		await fetch(`/api/repos/${encodeURIComponent(name)}/scan`, {
			method: "POST",
		});
	} finally {
		const next = new Set(scanningRepos.value);
		next.delete(name);
		scanningRepos.value = next;
	}
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function openInFinder(repoPath: string): void {
	// macOS：透過後端呼叫 `open` 指令；若無後端支援則 fallback 顯示路徑
	fetch("/api/repos/open", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: repoPath }),
	}).catch(() => {
		// 無支援時靜默失敗，使用者可從卡片上複製路徑
	});
}

// ── 顯示輔助 ─────────────────────────────────────────────────────────
// biome-ignore lint/correctness/noUnusedVariables: used in template
function roleTagType(
	role: string,
): "primary" | "success" | "warning" | "info" | "danger" {
	if (role === "main") return "primary";
	if (role === "temp") return "warning";
	return "info";
}
</script>

<template>
  <div v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 標頭 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row align="middle" justify="space-between">
        <el-col :span="14">
          <el-statistic title="Repo 總數" :value="repos.length" style="display:inline-block; margin-right:24px" />
          <div style="margin-top:4px; font-size:12px; color:var(--el-text-color-secondary)">
            更新時間：{{ formatRelative(timestamp) }}
          </div>
        </el-col>
        <el-col :span="8">
          <el-input
            v-model="searchQuery"
            placeholder="搜尋 Repo 名稱或路徑..."
            clearable
            size="small"
            prefix-icon="Search"
          />
        </el-col>
      </el-row>
    </el-card>

    <!-- 三態 -->
    <template v-if="loading">
      <!-- skeleton -->
      <el-skeleton :rows="4" animated style="margin-bottom:16px" />
      <el-skeleton :rows="4" animated />
    </template>

    <el-empty
      v-else-if="isEmpty(repos)"
      description="尚未執行 d:scan，無 Repo 快取資料"
    />

    <template v-else>
      <el-empty
        v-if="isEmpty(filteredRepos)"
        description="無符合搜尋條件的 Repo"
      />

      <!-- 角色分組折疊面板 -->
      <el-collapse v-else v-model="activeCollapse">
        <el-collapse-item
          v-for="group in roleGroups"
          :key="group.role"
          :name="group.role"
        >
          <template #title>
            <span style="font-weight:600; margin-right:8px">{{ group.label }}</span>
            <el-badge :value="group.items.length" type="primary" />
          </template>

          <!-- Repo 卡片網格 -->
          <el-row :gutter="12" style="margin-top:4px">
            <el-col
              v-for="repo in group.items"
              :key="repo.path || repo.name"
              :xs="24"
              :sm="12"
              :md="8"
              :lg="6"
              style="margin-bottom:12px"
            >
              <el-card shadow="hover" style="height:100%">
                <!-- 標題列 -->
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap">
                  <el-icon><Folder /></el-icon>
                  <span style="font-weight:600; font-size:14px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{{ repo.name }}</span>
                  <el-tag :type="roleTagType(repo.role)" size="small">{{ repo.role }}</el-tag>
                </div>

                <!-- 路徑 -->
                <div
                  style="font-size:12px; color:var(--el-text-color-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:8px"
                  :title="repo.path"
                >
                  {{ repo.path || "—" }}
                </div>

                <!-- 技術棧 tags -->
                <div v-if="repo.techStacks.length > 0" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px">
                  <el-tag
                    v-for="tech in repo.techStacks"
                    :key="tech"
                    size="small"
                    effect="plain"
                    type="info"
                  >{{ tech }}</el-tag>
                </div>

                <!-- Branch / Last Commit -->
                <div v-if="repo.branch || repo.lastCommit" style="font-size:12px; color:var(--el-text-color-secondary); margin-bottom:8px">
                  <span v-if="repo.branch">
                    <el-icon style="vertical-align:middle"><Promotion /></el-icon>
                    {{ repo.branch }}
                  </span>
                  <span v-if="repo.branch && repo.lastCommit" style="margin:0 4px">·</span>
                  <span v-if="repo.lastCommit">{{ repo.lastCommit }}</span>
                </div>

                <!-- 操作按鈕 -->
                <div style="display:flex; gap:8px; margin-top:8px">
                  <el-button
                    size="small"
                    :loading="scanningRepos.has(repo.name)"
                    @click="scanRepo(repo.name)"
                  >掃描</el-button>
                  <el-button
                    size="small"
                    type="info"
                    plain
                    @click="openInFinder(repo.path)"
                  >開啟</el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>
