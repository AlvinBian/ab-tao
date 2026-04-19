<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const d = computed(() => store.data?.extended?.hooks);
const filterStatus = ref<"all" | "healthy" | "unhealthy">("all");
const redeploying = ref<string | null>(null);

const filteredHooks = computed(() => {
	const hooks = d.value?.hooks ?? [];
	if (filterStatus.value === "healthy")
		return hooks.filter((h) => h.exists && h.executable);
	if (filterStatus.value === "unhealthy")
		return hooks.filter((h) => !h.exists || !h.executable);
	return hooks;
});

function tagType(row: {
	exists: boolean;
	executable: boolean;
}): "success" | "warning" | "danger" {
	if (row.exists && row.executable) return "success";
	if (row.exists) return "warning";
	return "danger";
}

function tagLabel(row: { exists: boolean; executable: boolean }): string {
	if (row.exists && row.executable) return "healthy";
	if (row.exists) return "not-exec";
	return "missing";
}

async function redeploy(hookId: string) {
	redeploying.value = hookId;
	try {
		const r = await fetch("/api/hooks/redeploy", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ hookId }),
		});
		const { code, message } = (await r.json()) as {
			code: number;
			message: string;
		};
		if (code === 0) {
			ElMessage.success("Hook 已重新部署");
			store.fetchData(true);
		} else {
			ElMessage.error(message);
		}
	} catch {
		ElMessage.error("操作失敗，請檢查 API Server");
	} finally {
		redeploying.value = null;
	}
}

async function redeployAll() {
	await ElMessageBox.confirm(
		"將重新複製所有 Hook 腳本並更新 settings.json，確定繼續？",
		"全部重新部署",
		{ confirmButtonText: "確認", cancelButtonText: "取消", type: "warning" },
	);
	await redeploy("all");
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 摘要卡 -->
    <el-row :gutter="12" style="margin-bottom:16px">
      <el-col :span="6">
        <el-card shadow="never">
          <el-statistic title="總計" :value="d?.total ?? 0" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <el-statistic title="健康" :value="d?.healthy ?? 0">
            <template #suffix>
              <el-tag type="success" size="small" style="margin-left:4px">healthy</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <el-statistic title="異常" :value="(d?.total ?? 0) - (d?.healthy ?? 0)">
            <template #suffix v-if="(d?.total ?? 0) - (d?.healthy ?? 0) > 0">
              <el-tag type="danger" size="small" style="margin-left:4px">需修復</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- Hooks 表格 -->
    <el-card shadow="never">
      <template #header>
        <div style="display:flex; align-items:center; gap:12px">
          <span>Hooks 健檢</span>
          <el-radio-group v-model="filterStatus" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="healthy">健康</el-radio-button>
            <el-radio-button value="unhealthy">異常</el-radio-button>
          </el-radio-group>
          <el-button
            size="small"
            type="warning"
            plain
            style="margin-left:auto"
            :loading="redeploying === 'all'"
            @click="redeployAll"
          >
            全部重新部署
          </el-button>
        </div>
      </template>
      <el-table :data="filteredHooks" stripe style="width:100%">
        <el-table-column prop="event" label="Event" width="180" />
        <el-table-column prop="name" label="名稱" min-width="160" show-overflow-tooltip />
        <el-table-column label="狀態" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="tagType(row)" size="small">{{ tagLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="script" label="Script" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:12px; color:var(--el-text-color-secondary)">{{ row.script }}</code>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center">
          <template #default="{ row }">
            <el-popconfirm
              v-if="row.id"
              title="確認重新部署此 Hook？"
              confirm-button-text="確認"
              cancel-button-text="取消"
              @confirm="redeploy(row.id)"
            >
              <template #reference>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="redeploying === row.id"
                >
                  重新部署
                </el-button>
              </template>
            </el-popconfirm>
            <span v-else style="color:var(--el-text-color-placeholder); font-size:12px">—</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="filteredHooks.length === 0 && !store.loading" description="無 Hook 資料" />
    </el-card>
  </div>
</template>
