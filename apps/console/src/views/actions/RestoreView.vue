<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useSse } from "@/composables/useSse";

type ActionState =
	| "idle"
	| "running"
	| "success"
	| "failed"
	| "retrying"
	| "retry-failed";

const MAX_RETRIES = 3;

interface BackupItem {
	id: string;
	fileCount: number;
	size: string;
	contents: string[];
}

const backups = ref<BackupItem[]>([]);
const loading = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const dryRun = ref(false);

// 狀態機
const actionState = ref<ActionState>("idle");
const retryCount = ref(0);
const traceId = ref("");
const currentBackupId = ref<string | null>(null);

// 記錄
const logLines = ref<string[]>([]);
const logContainer = ref<HTMLElement | null>(null);

const successCount = computed(
	() => logLines.value.filter((l) => /✓|success|PASS/i.test(l)).length,
);
const warnCount = computed(
	() => logLines.value.filter((l) => /⚠|warn/i.test(l)).length,
);
const errorCount = computed(
	() => logLines.value.filter((l) => /✗|error|FAIL/i.test(l)).length,
);

const sse = useSse({
	onDone: (e) => {
		if (e.success) {
			actionState.value = "success";
			ElMessage.success("還原完成");
		} else {
			actionState.value = retryCount.value > 0 ? "retry-failed" : "failed";
			ElMessage.error("還原失敗");
		}
	},
	onEvent: (e) => {
		if (e.type === "log" && e.message) {
			logLines.value.push(e.message);
			nextTick(() => {
				if (logContainer.value) {
					logContainer.value.scrollTop = logContainer.value.scrollHeight;
				}
			});
		}
	},
});

watch(
	() => sse.logs.value.length,
	() => {
		logLines.value = sse.logs.value.map((l) => l.message);
	},
);

async function fetchBackups() {
	loading.value = true;
	try {
		const r = await fetch("/api/restore/backups");
		const { code, message, data } = await r.json();
		if (code !== 0) {
			ElMessage.error(message ?? "無法載入備份列表");
			return;
		}
		backups.value = Array.isArray(data) ? data : [];
	} catch {
		ElMessage.error("無法載入備份列表");
	} finally {
		loading.value = false;
	}
}

function runRestore(backupId: string) {
	traceId.value = Date.now().toString(36);
	logLines.value = [];
	sse.reset();
	const body: Record<string, unknown> = { backupId };
	if (dryRun.value) body.dryRun = true;
	const url = dryRun.value
		? "/api/restore/execute?dryRun=true"
		: "/api/restore/execute";
	sse.start(url, body);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function restore(backupId: string) {
	currentBackupId.value = backupId;
	retryCount.value = 0;
	actionState.value = "running";
	runRestore(backupId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function retryRestore() {
	if (retryCount.value >= MAX_RETRIES || !currentBackupId.value) return;
	retryCount.value += 1;
	actionState.value = "retrying";
	runRestore(currentBackupId.value);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyLog() {
	await navigator.clipboard.writeText(logLines.value.join("\n"));
	ElMessage.success("已複製完整記錄");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyTraceId() {
	await navigator.clipboard.writeText(traceId.value);
	ElMessage.success("已複製 traceId");
}

const isRunning = computed(
	() => actionState.value === "running" || actionState.value === "retrying",
);
const isFailed = computed(
	() => actionState.value === "failed" || actionState.value === "retry-failed",
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const retryExhausted = computed(() => retryCount.value >= MAX_RETRIES);

onMounted(fetchBackups);
</script>

<template>
  <div>
    <!-- Dry-run 警告橫幅 -->
    <el-alert
      v-if="dryRun"
      title="Dry-run 模式：不會實際寫入變更"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom:16px"
    />

    <!-- Dry-run 切換 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>操作設定</span></template>
      <el-form label-width="80px" label-position="left" size="small">
        <el-form-item label="Dry-run">
          <el-switch v-model="dryRun" active-text="Dry-run 預覽" />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 備份趨勢圖 -->
    <el-card v-if="backups.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header><span>備份歷史（最近 12 筆）</span></template>
      <BackupSizeBar
        :backups="backups.map(b => ({ id: b.id, fileCount: b.fileCount }))"
      />
    </el-card>

    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>備份列表</span>
        <el-button size="small" style="margin-left:8px" @click="fetchBackups">重新整理</el-button>
      </template>

      <el-table v-loading="loading" :data="backups" size="small" style="width:100%">
        <el-table-column prop="id" label="備份 ID" show-overflow-tooltip />
        <el-table-column prop="fileCount" label="檔案數" width="80" align="center" />
        <el-table-column prop="size" label="大小" width="90" align="right" />
        <el-table-column label="內容" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="c in row.contents"
              :key="c"
              size="small"
              style="margin-right:4px; margin-bottom:2px"
            >
              {{ c }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center">
          <template #default="{ row }">
            <el-popconfirm
              :title="`確認還原備份 ${row.id}？`"
              confirm-button-text="確認還原"
              cancel-button-text="取消"
              confirm-button-type="danger"
              @confirm="restore(row.id)"
            >
              <template #reference>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :loading="isRunning && currentBackupId === row.id"
                  :disabled="isRunning && currentBackupId !== row.id"
                >
                  還原
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && backups.length === 0"
        description="尚無備份，執行 Resources/Config 變更後會自動建立備份"
        :image-size="60"
      />
    </el-card>

    <!-- 還原輸出 -->
    <el-card v-if="logLines.length > 0 || isRunning" shadow="never" style="margin-bottom:16px">
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px">
          <span>還原輸出{{ currentBackupId ? ` — ${currentBackupId}` : '' }}</span>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            <template v-if="traceId">
              <span style="font-size:12px; color:#909399">traceId: {{ traceId }}</span>
              <span style="font-size:12px; color:#909399">重試: {{ retryCount }}/{{ 3 }}</span>
              <el-button size="small" @click="copyTraceId">複製 traceId</el-button>
            </template>
            <el-button v-if="logLines.length > 0" size="small" @click="copyLog">複製完整記錄</el-button>
          </div>
        </div>
      </template>

      <el-progress
        v-if="isRunning || sse.done.value"
        :percentage="sse.progress.value"
        :status="sse.done.value ? (sse.success.value ? 'success' : 'exception') : undefined"
        style="margin-bottom:12px"
      />

      <div
        v-if="sse.done.value && logLines.length > 0"
        style="display:flex; gap:8px; margin-bottom:12px"
      >
        <el-tag type="success">成功 {{ successCount }}</el-tag>
        <el-tag type="warning">警告 {{ warnCount }}</el-tag>
        <el-tag type="danger">失敗 {{ errorCount }}</el-tag>
      </div>

      <div
        ref="logContainer"
        class="action-log"
        :style="{ height: '300px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', background: '#1e1e1e', color: '#d4d4d4', padding: '8px', borderRadius: '4px' }"
      >
        <div v-if="logLines.length === 0" style="color:#666">等待輸出…</div>
        <div
          v-for="(line, i) in logLines"
          :key="i"
          :style="{
            color: /✗|error|FAIL/i.test(line) ? '#f56c6c' : /⚠|warn/i.test(line) ? '#e6a23c' : /✓|success|PASS/i.test(line) ? '#67c23a' : '#d4d4d4'
          }"
        >{{ line }}</div>
      </div>

      <el-alert
        v-if="sse.errorMsg.value"
        :title="sse.errorMsg.value"
        type="error"
        show-icon
        :closable="false"
        style="margin-top:8px"
      />
    </el-card>

    <!-- 重試控制 -->
    <el-card v-if="isFailed" shadow="never" style="margin-bottom:16px">
      <template #header><span>重試控制</span></template>
      <div style="display:flex; gap:8px; align-items:center">
        <el-button
          v-if="!retryExhausted"
          type="warning"
          @click="retryRestore"
        >
          重試還原（{{ retryCount }}/{{ 3 }}）
        </el-button>
        <el-button v-else disabled>已達重試上限</el-button>
      </div>
    </el-card>

    <el-alert
      title="注意：還原會覆蓋當前 ~/.claude/ 及 ZSH 配置，建議在確認目標備份正確後再執行。"
      type="warning"
      show-icon
      :closable="false"
    />
  </div>
</template>
