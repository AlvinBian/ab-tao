<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useStatusStore } from "@/stores/status";
import type { CachedRepo } from "@/types/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const repos = computed(() => store.data?.cachedRepos ?? []);
const timestamp = computed(() => store.data?.cachedTimestamp);
const searchQuery = ref("");

const filteredRepos = computed(() => {
	const q = searchQuery.value.toLowerCase();
	if (!q) return repos.value;
	return repos.value.filter((r) => {
		const name = String(r.name ?? r.localPath ?? "").toLowerCase();
		return name.includes(q);
	});
});

function getRepoName(repo: CachedRepo): string {
	if (repo.name) return String(repo.name);
	if (repo.localPath)
		return String(repo.localPath).split("/").pop() ?? String(repo.localPath);
	return "—";
}

function getRole(repo: CachedRepo): string {
	return String(repo.role ?? "—");
}

function roleTagType(role: string): "primary" | "success" | "warning" | "info" {
	if (role === "main") return "primary";
	if (role === "lib") return "success";
	if (role === "tool") return "warning";
	return "info";
}

function formatTimestamp(ts: string | null | undefined): string {
	if (!ts) return "從未更新";
	return new Date(ts).toLocaleString("zh-TW");
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 標頭 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row align="middle" justify="space-between">
        <el-col :span="12">
          <span style="font-size:14px">掃描快取：</span>
          <el-tag size="small" type="info">{{ formatTimestamp(timestamp) }}</el-tag>
          <span style="margin-left:12px; color:var(--el-text-color-secondary); font-size:13px">
            共 {{ repos.length }} 個 Repo
          </span>
        </el-col>
        <el-col :span="8">
          <el-input
            v-model="searchQuery"
            placeholder="搜尋 Repo 名稱..."
            clearable
            size="small"
            prefix-icon="Search"
          />
        </el-col>
      </el-row>
    </el-card>

    <!-- Repo 卡片清單 -->
    <el-row :gutter="12" v-if="filteredRepos.length > 0">
      <el-col
        v-for="(repo, i) in filteredRepos"
        :key="i"
        :span="8"
        style="margin-bottom:12px"
      >
        <el-card shadow="hover" style="height:100%">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px">
            <el-icon><Folder /></el-icon>
            <span style="font-weight:600; font-size:14px">{{ getRepoName(repo) }}</span>
            <el-tag :type="roleTagType(getRole(repo))" size="small">{{ getRole(repo) }}</el-tag>
          </div>
          <div v-if="repo.localPath" style="font-size:12px; color:var(--el-text-color-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
            {{ repo.localPath }}
          </div>
          <!-- 額外欄位 -->
          <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px">
            <template v-for="[key, val] in Object.entries(repo)" :key="key">
              <el-tag
                v-if="key !== 'name' && key !== 'localPath' && key !== 'role' && val"
                size="small"
                type="info"
              >{{ key }}: {{ val }}</el-tag>
            </template>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty
      v-if="!store.loading && filteredRepos.length === 0"
      :description="repos.length === 0 ? '尚未執行 d:scan，無快取資料' : '無符合搜尋條件的 Repo'"
    />
  </div>
</template>
