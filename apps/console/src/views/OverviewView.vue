<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useElCssVar } from "@/composables/useElCssVar";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const successColor = useElCssVar("--el-color-success", "#67c23a");
const warningColor = useElCssVar("--el-color-warning", "#e6a23c");
const dangerColor = useElCssVar("--el-color-danger", "#f56c6c");

const d = computed(() => store.data);
const healthPct = computed(() => d.value?.overview?.healthPct ?? 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasDailyCounts = computed(
	() => Object.keys(dailyCounts.value).length > 0,
);

const byProject = computed(
	() => (d.value?.sessions?.byProject as Record<string, number>) ?? {},
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasByProject = computed(() => Object.keys(byProject.value).length > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const radarScores = computed(() => ({
	commandUsageRate: Math.min(100, (d.value?.commands?.length ?? 0) * 5),
	agentUsageRate: Math.min(100, (d.value?.agents?.length ?? 0) * 25),
	hookHealthRate:
		(d.value?.extended?.hooks?.total ?? 0) > 0
			? Math.round(
					((d.value?.extended?.hooks?.healthy ?? 0) /
						(d.value?.extended?.hooks?.total ?? 1)) *
						100,
				)
			: 0,
	skillEnabledRate:
		(d.value?.skills?.length ?? 0) > 0
			? Math.round(
					((d.value?.skills?.filter((s) => s.enabled).length ?? 0) /
						(d.value?.skills?.length ?? 1)) *
						100,
				)
			: 0,
	envScore: Math.max(0, 100 - (d.value?.extended?.drift?.length ?? 0) * 10),
}));

// biome-ignore lint/correctness/noUnusedVariables: used in template
const healthColor = computed(() => {
	if (healthPct.value >= 80) return successColor.value;
	if (healthPct.value >= 50) return warningColor.value;
	return dangerColor.value;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
            <el-card shadow="never" class="overview-stat-card">
              <el-statistic :title="item.label" :value="item.value" style="--el-statistic-title-font-size:12px" />
            </el-card>
          </el-col>
        </el-row>
      </el-col>
    </el-row>

    <!-- 健康維度雷達 -->
    <el-card v-if="d" shadow="never" style="margin-bottom:16px">
      <template #header><span>健康維度雷達</span></template>
      <OverviewRadar v-bind="radarScores" />
    </el-card>

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

<style scoped>
/* 統計卡與健康卡同高（148px），內容垂直水平居中 */
.overview-stat-card {
  height: 148px;
}
.overview-stat-card :deep(.el-card__body) {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
}
</style>
