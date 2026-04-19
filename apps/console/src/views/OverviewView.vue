<script setup lang="ts">
import { computed, onMounted } from "vue";
import SessionByProjectBar from "@/charts/SessionByProjectBar.vue";
import UsageHeatmap from "@/charts/UsageHeatmap.vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const d = computed(() => store.data);
const healthPct = computed(() => d.value?.overview?.healthPct ?? 0);

const statCards = computed(() => [
	{
		label: "Skills",
		value: d.value?.skills?.filter((s) => s.enabled).length ?? 0,
		icon: "Star",
	},
	{
		label: "Commands",
		value: d.value?.commands?.length ?? 0,
		icon: "Operation",
	},
	{ label: "Agents", value: d.value?.agents?.length ?? 0, icon: "Avatar" },
	{
		label: "Rules",
		value: d.value?.rules?.filter((r) => r.enabled).length ?? 0,
		icon: "List",
	},
	{
		label: "Hooks",
		value: d.value?.extended?.hooks?.healthy ?? 0,
		icon: "Connection",
	},
	{
		label: "Sessions",
		value: d.value?.sessions?.total ?? 0,
		icon: "ChatDotRound",
	},
]);

const dailyCounts = computed(
	() => (d.value?.sessions?.dailyCounts as Record<string, number>) ?? {},
);
const hasDailyCounts = computed(
	() => Object.keys(dailyCounts.value).length > 0,
);

const byProject = computed(
	() => (d.value?.sessions?.byProject as Record<string, number>) ?? {},
);
const hasByProject = computed(() => Object.keys(byProject.value).length > 0);

const healthColor = computed(() => {
	if (healthPct.value >= 80) return "#67c23a";
	if (healthPct.value >= 50) return "#e6a23c";
	return "#f56c6c";
});

function formatBytes(bytes: number): string {
	if (!bytes) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 健康度 + Stat 卡 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="5">
        <el-card shadow="never" style="height:148px">
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%">
            <el-progress
              type="dashboard"
              :percentage="healthPct"
              :color="healthColor"
              :stroke-width="10"
              :width="100"
            >
              <template #default="{ percentage }">
                <span style="font-size:18px; font-weight:700">{{ percentage }}%</span>
              </template>
            </el-progress>
            <div style="margin-top:6px; font-size:13px; color:var(--el-text-color-secondary)">健康度</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="19">
        <el-row :gutter="12">
          <el-col v-for="item in statCards" :key="item.label" :span="4">
            <el-card shadow="never" style="height:68px; margin-bottom:12px">
              <el-statistic :title="item.label" :value="item.value" style="--el-statistic-title-font-size:12px" />
            </el-card>
          </el-col>
        </el-row>
      </el-col>
    </el-row>

    <!-- Session 活躍度熱力圖 -->
    <el-card v-if="hasDailyCounts" shadow="never" style="margin-bottom:16px">
      <template #header><span>Session 活躍度（當年）</span></template>
      <UsageHeatmap :daily-counts="dailyCounts" />
    </el-card>

    <el-row :gutter="16" style="margin-bottom:16px">
      <!-- Top Projects Bar -->
      <el-col :span="12">
        <el-card shadow="never" style="height:100%">
          <template #header><span>Top Projects（Sessions 數）</span></template>
          <SessionByProjectBar v-if="hasByProject" :by-project="byProject" :top-n="8" />
          <el-empty v-else description="無 Session 資料" :image-size="40" />
        </el-card>
      </el-col>

      <!-- AI 模型 + 磁碟使用 -->
      <el-col :span="12">
        <el-card shadow="never" style="margin-bottom:12px">
          <template #header><span>AI 模型設定</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="主要模型">
              <el-tag size="small">{{ d?.ai?.model ?? '—' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Effort">{{ d?.ai?.effort ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="Repo 模型">{{ d?.ai?.repoModel ?? '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card shadow="never">
          <template #header><span>磁碟使用</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="Cache">{{ formatBytes(d?.diskUsage?.cache ?? 0) }}</el-descriptions-item>
            <el-descriptions-item label="Dist">{{ formatBytes(d?.diskUsage?.dist ?? 0) }}</el-descriptions-item>
            <el-descriptions-item label="Projects">{{ formatBytes(d?.diskUsage?.claudeProjects ?? 0) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <!-- Drift 警示 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>Config Drift</span>
        <el-tag
          v-if="(d?.extended?.drift?.length ?? 0) > 0"
          type="warning"
          size="small"
          style="margin-left:8px"
        >{{ d?.extended?.drift?.length }} 個異動</el-tag>
        <el-tag v-else type="success" size="small" style="margin-left:8px">無 Drift</el-tag>
      </template>
      <el-table :data="d?.extended?.drift?.slice(0, 5) ?? []" size="small" style="width:100%">
        <el-table-column prop="path" label="路徑" show-overflow-tooltip />
        <el-table-column prop="decision" label="狀態" width="90">
          <template #default="{ row }">
            <el-tag :type="row.decision === 'deleted' ? 'danger' : 'warning'" size="small">
              {{ row.decision }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-empty v-if="!store.loading && !store.data && !store.error" description="尚無資料，請確認 API server 已啟動" />
  </div>
</template>
