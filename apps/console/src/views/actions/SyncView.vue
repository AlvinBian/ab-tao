<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import ProgressWithLog from "@/components/ProgressWithLog.vue";
import { useSse } from "@/composables/useSse";

interface SyncDiff {
	label: string;
	status:
		| "in-sync"
		| "diverged"
		| "local-only"
		| "remote-only"
		| "both-missing"
		| "error";
}

interface SyncStatus {
	available: boolean;
	lastPush: string | null;
	lastPull: string | null;
	device: string | null;
	diffs: SyncDiff[];
}

const syncStatus = ref<SyncStatus | null>(null);
const loadingStatus = ref(false);

const pushSse = useSse({
	onDone: (e) => {
		if (e.success) {
			ElMessage.success("推送完成");
			fetchStatus();
		} else ElMessage.error("推送失敗");
	},
});

const pullSse = useSse({
	onDone: (e) => {
		if (e.success) {
			ElMessage.success("拉取完成");
			fetchStatus();
		} else ElMessage.error("拉取失敗");
	},
});

async function fetchStatus() {
	loadingStatus.value = true;
	try {
		const r = await fetch("/api/sync/status");
		const { data } = await r.json();
		syncStatus.value = data;
	} finally {
		loadingStatus.value = false;
	}
}

onMounted(fetchStatus);

function push() {
	pushSse.reset();
	pushSse.start("/api/sync/push", {});
}

function pull() {
	pullSse.reset();
	pullSse.start("/api/sync/pull", {});
}

const STATUS_MAP: Record<
	string,
	{ label: string; type: "success" | "danger" | "info" | "warning" }
> = {
	"in-sync": { label: "同步", type: "success" },
	diverged: { label: "有差異", type: "warning" },
	"local-only": { label: "僅本地", type: "info" },
	"remote-only": { label: "僅遠端", type: "info" },
	"both-missing": { label: "兩端均缺", type: "danger" },
	error: { label: "錯誤", type: "danger" },
};
</script>

<template>
  <div>
    <!-- iCloud 狀態 -->
    <el-card v-loading="loadingStatus" shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>iCloud 同步狀態</span>
        <el-button
          size="small"
          :loading="loadingStatus"
          style="margin-left:8px"
          @click="fetchStatus"
        >
          刷新
        </el-button>
      </template>

      <template v-if="syncStatus">
        <el-alert
          v-if="!syncStatus.available"
          title="iCloud Drive 不可用（未登入或系統不支援）"
          type="error"
          show-icon
          :closable="false"
          style="margin-bottom:16px"
        />

        <el-descriptions :column="3" size="small" border style="margin-bottom:16px">
          <el-descriptions-item label="iCloud 可用">
            <el-tag :type="syncStatus.available ? 'success' : 'danger'" size="small">
              {{ syncStatus.available ? '可用' : '不可用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="上次推送">
            {{ syncStatus.lastPush ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="上次拉取">
            {{ syncStatus.lastPull ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="裝置">
            {{ syncStatus.device ?? '—' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 檔案差異清單 -->
        <el-table :data="syncStatus.diffs" size="small" style="width:100%; margin-bottom:16px">
          <el-table-column prop="label" label="檔案" min-width="220" />
          <el-table-column label="狀態" width="120" align="center">
            <template #default="{ row }">
              <el-tag
                :type="STATUS_MAP[row.status]?.type ?? 'info'"
                size="small"
              >
                {{ STATUS_MAP[row.status]?.label ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <!-- 操作按鈕 -->
        <div style="display:flex; gap:10px">
          <el-button
            type="primary"
            :loading="pushSse.running.value"
            :disabled="!syncStatus.available"
            @click="push"
          >
            推送本地 → iCloud
          </el-button>
          <el-button
            :loading="pullSse.running.value"
            :disabled="!syncStatus.available"
            @click="pull"
          >
            從 iCloud 拉取
          </el-button>
        </div>
      </template>

      <el-empty v-else description="載入中…" :image-size="40" />
    </el-card>

    <!-- 推送輸出 -->
    <el-card v-if="pushSse.logs.value.length || pushSse.running.value" shadow="never" style="margin-bottom:16px">
      <template #header><span>推送輸出</span></template>
      <ProgressWithLog
        :running="pushSse.running.value"
        :done="pushSse.done.value"
        :success="pushSse.success.value"
        :progress="pushSse.progress.value"
        :stage="pushSse.stage.value"
        :logs="pushSse.logs.value"
        :error-msg="pushSse.errorMsg.value"
        log-height="200px"
      />
    </el-card>

    <!-- 拉取輸出 -->
    <el-card v-if="pullSse.logs.value.length || pullSse.running.value" shadow="never">
      <template #header><span>拉取輸出</span></template>
      <ProgressWithLog
        :running="pullSse.running.value"
        :done="pullSse.done.value"
        :success="pullSse.success.value"
        :progress="pullSse.progress.value"
        :stage="pullSse.stage.value"
        :logs="pullSse.logs.value"
        :error-msg="pullSse.errorMsg.value"
        log-height="200px"
      />
    </el-card>
  </div>
</template>
