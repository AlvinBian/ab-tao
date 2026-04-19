<script setup lang="ts">
import { onMounted } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchOverview());

const statItems = [
	{ key: "commands", label: "Commands" },
	{ key: "agents", label: "Agents" },
	{ key: "rules", label: "Rules" },
	{ key: "skills", label: "Skills" },
];

function countEnabled(
	list:
		| { core: string[]; ext: string[]; user: string[]; disabled: string[] }
		| undefined,
) {
	if (!list) return 0;
	return list.core.length + list.ext.length + list.user.length;
}
</script>

<template>
  <div v-loading="store.loading">
    <el-row :gutter="16" style="margin-bottom: 16px">
      <!-- 健康度 -->
      <el-col :span="6">
        <el-card shadow="never">
          <div style="text-align:center; padding: 8px 0">
            <el-progress
              type="dashboard"
              :percentage="store.overview?.healthPct ?? 0"
              :color="[
                { color: '#f56c6c', percentage: 40 },
                { color: '#e6a23c', percentage: 70 },
                { color: '#67c23a', percentage: 100 },
              ]"
              :stroke-width="12"
              :width="120"
            />
            <div style="margin-top: 8px; font-weight: 600">健康度</div>
          </div>
        </el-card>
      </el-col>

      <!-- Stat 卡 -->
      <el-col :span="18">
        <el-row :gutter="12">
          <el-col
            v-for="item in statItems"
            :key="item.key"
            :span="6"
          >
            <el-card shadow="never">
              <el-statistic
                :title="item.label"
                :value="countEnabled((store.overview as Record<string, unknown>)?.[item.key] as Parameters<typeof countEnabled>[0])"
              />
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never">
              <el-statistic
                title="Hooks"
                :value="store.overview?.hooks?.installed ? Object.values(store.overview.hooks.events ?? {}).reduce((a, b) => a + b, 0) : 0"
              />
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never">
              <el-statistic
                title="Sessions"
                :value="store.overview?.sessions?.total ?? 0"
              />
            </el-card>
          </el-col>
        </el-row>
      </el-col>
    </el-row>

    <!-- Drift 警告 -->
    <template v-if="!store.loading && store.overview">
      <el-alert
        v-if="store.error"
        :title="store.error"
        type="error"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-card shadow="never">
        <template #header>
          <span>AI 模型設定</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="主要模型">{{ store.overview.ai?.model ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="Effort">{{ store.overview.ai?.effort ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="Repo 模型">{{ store.overview.ai?.repoModel ?? '—' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <el-empty v-if="!store.loading && !store.overview && !store.error" description="尚無資料，請確認 API server 已啟動" />
  </div>
</template>
