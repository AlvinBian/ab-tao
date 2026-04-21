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

// biome-ignore lint/correctness/noUnusedVariables: used in template
const dryRun = ref(false);

// ── Push 狀態機 ──
const pushState = ref<ActionState>("idle");
const pushRetryCount = ref(0);
const pushTraceId = ref("");
const pushLogLines = ref<string[]>([]);
const pushLogContainer = ref<HTMLElement | null>(null);

const pushSuccessCount = computed(
	() => pushLogLines.value.filter((l) => /✓|success|PASS/i.test(l)).length,
);
const pushWarnCount = computed(
	() => pushLogLines.value.filter((l) => /⚠|warn/i.test(l)).length,
);
const pushErrorCount = computed(
	() => pushLogLines.value.filter((l) => /✗|error|FAIL/i.test(l)).length,
);

const pushSse = useSse({
	onDone: (e) => {
		if (e.success) {
			pushState.value = "success";
			ElMessage.success("推送完成");
			fetchStatus();
		} else {
			pushState.value = pushRetryCount.value > 0 ? "retry-failed" : "failed";
			ElMessage.error("推送失敗");
		}
	},
	onEvent: (e) => {
		if (e.type === "log" && e.message) {
			pushLogLines.value.push(e.message);
			nextTick(() => {
				if (pushLogContainer.value) {
					pushLogContainer.value.scrollTop =
						pushLogContainer.value.scrollHeight;
				}
			});
		}
	},
});

watch(
	() => pushSse.logs.value.length,
	() => {
		pushLogLines.value = pushSse.logs.value.map((l) => l.message);
	},
);

// ── Pull 狀態機 ──
const pullState = ref<ActionState>("idle");
const pullRetryCount = ref(0);
const pullTraceId = ref("");
const pullLogLines = ref<string[]>([]);
const pullLogContainer = ref<HTMLElement | null>(null);

const pullSuccessCount = computed(
	() => pullLogLines.value.filter((l) => /✓|success|PASS/i.test(l)).length,
);
const pullWarnCount = computed(
	() => pullLogLines.value.filter((l) => /⚠|warn/i.test(l)).length,
);
const pullErrorCount = computed(
	() => pullLogLines.value.filter((l) => /✗|error|FAIL/i.test(l)).length,
);

const pullSse = useSse({
	onDone: (e) => {
		if (e.success) {
			pullState.value = "success";
			ElMessage.success("拉取完成");
			fetchStatus();
		} else {
			pullState.value = pullRetryCount.value > 0 ? "retry-failed" : "failed";
			ElMessage.error("拉取失敗");
		}
	},
	onEvent: (e) => {
		if (e.type === "log" && e.message) {
			pullLogLines.value.push(e.message);
			nextTick(() => {
				if (pullLogContainer.value) {
					pullLogContainer.value.scrollTop =
						pullLogContainer.value.scrollHeight;
				}
			});
		}
	},
});

watch(
	() => pullSse.logs.value.length,
	() => {
		pullLogLines.value = pullSse.logs.value.map((l) => l.message);
	},
);

// ── Status ──
async function fetchStatus() {
	loadingStatus.value = true;
	try {
		const r = await fetch("/api/sync/status");
		const { code, message, data } = await r.json();
		if (code !== 0) {
			ElMessage.error(message ?? "無法載入同步狀態");
			return;
		}
		syncStatus.value = data;
	} catch {
		ElMessage.error("無法載入同步狀態");
	} finally {
		loadingStatus.value = false;
	}
}

onMounted(fetchStatus);

// ── Push 操作 ──
function runPush() {
	pushTraceId.value = Date.now().toString(36);
	pushLogLines.value = [];
	pushSse.reset();
	const url = dryRun.value ? "/api/sync/push?dryRun=true" : "/api/sync/push";
	pushSse.start(url, dryRun.value ? { dryRun: true } : {});
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function push() {
	pushRetryCount.value = 0;
	pushState.value = "running";
	runPush();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function retryPush() {
	if (pushRetryCount.value >= MAX_RETRIES) return;
	pushRetryCount.value += 1;
	pushState.value = "retrying";
	runPush();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyPushLog() {
	await navigator.clipboard.writeText(pushLogLines.value.join("\n"));
	ElMessage.success("已複製推送記錄");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyPushTraceId() {
	await navigator.clipboard.writeText(pushTraceId.value);
	ElMessage.success("已複製 traceId");
}

// ── Pull 操作 ──
function runPull() {
	pullTraceId.value = Date.now().toString(36);
	pullLogLines.value = [];
	pullSse.reset();
	const url = dryRun.value ? "/api/sync/pull?dryRun=true" : "/api/sync/pull";
	pullSse.start(url, dryRun.value ? { dryRun: true } : {});
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function pull() {
	pullRetryCount.value = 0;
	pullState.value = "running";
	runPull();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function retryPull() {
	if (pullRetryCount.value >= MAX_RETRIES) return;
	pullRetryCount.value += 1;
	pullState.value = "retrying";
	runPull();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyPullLog() {
	await navigator.clipboard.writeText(pullLogLines.value.join("\n"));
	ElMessage.success("已複製拉取記錄");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyPullTraceId() {
	await navigator.clipboard.writeText(pullTraceId.value);
	ElMessage.success("已複製 traceId");
}

// ── Computed helpers ──
const isPushRunning = computed(
	() => pushState.value === "running" || pushState.value === "retrying",
);
const isPushFailed = computed(
	() => pushState.value === "failed" || pushState.value === "retry-failed",
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const pushRetryExhausted = computed(() => pushRetryCount.value >= MAX_RETRIES);

const isPullRunning = computed(
	() => pullState.value === "running" || pullState.value === "retrying",
);
const isPullFailed = computed(
	() => pullState.value === "failed" || pullState.value === "retry-failed",
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const pullRetryExhausted = computed(() => pullRetryCount.value >= MAX_RETRIES);

// biome-ignore lint/correctness/noUnusedVariables: used in template
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

const logStyle = {
	height: "200px",
	overflowY: "auto" as const,
	fontFamily: "monospace",
	fontSize: "12px",
	background: "#1e1e1e",
	color: "#d4d4d4",
	padding: "8px",
	borderRadius: "4px",
};

function lineColor(line: string): string {
	if (/✗|error|FAIL/i.test(line)) return "#f56c6c";
	if (/⚠|warn/i.test(line)) return "#e6a23c";
	if (/✓|success|PASS/i.test(line)) return "#67c23a";
	return "#d4d4d4";
}
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

        <!-- 同步狀態分佈 -->
        <SyncDiffBar
          v-if="syncStatus.diffs.length > 0"
          :synced="syncStatus.diffs.filter(d => d.status === 'in-sync').length"
          :drift="syncStatus.diffs.filter(d => d.status === 'diverged' || d.status === 'local-only' || d.status === 'remote-only').length"
          :unknown="syncStatus.diffs.filter(d => d.status === 'both-missing' || d.status === 'error').length"
          style="margin-bottom:12px"
        />

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
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <!-- Push 按鈕組 -->
          <template v-if="!isPushRunning && pushState === 'idle'">
            <el-button
              type="primary"
              :disabled="!syncStatus.available"
              @click="push"
            >
              推送本地 → iCloud
            </el-button>
          </template>
          <template v-else-if="isPushRunning">
            <el-button type="primary" loading disabled>推送中…</el-button>
          </template>
          <template v-else-if="isPushFailed">
            <el-button
              v-if="!pushRetryExhausted"
              type="warning"
              :disabled="!syncStatus.available"
              @click="retryPush"
            >
              重試推送（{{ pushRetryCount }}/{{ 3 }}）
            </el-button>
            <el-button v-else disabled>推送已達重試上限</el-button>
            <el-button type="primary" :disabled="!syncStatus.available" @click="push">重新推送</el-button>
          </template>
          <template v-else-if="pushState === 'success'">
            <el-button type="primary" :disabled="!syncStatus.available" @click="push">再次推送</el-button>
          </template>

          <!-- Pull 按鈕組 -->
          <template v-if="!isPullRunning && pullState === 'idle'">
            <el-button
              :disabled="!syncStatus.available"
              @click="pull"
            >
              從 iCloud 拉取
            </el-button>
          </template>
          <template v-else-if="isPullRunning">
            <el-button loading disabled>拉取中…</el-button>
          </template>
          <template v-else-if="isPullFailed">
            <el-button
              v-if="!pullRetryExhausted"
              type="warning"
              :disabled="!syncStatus.available"
              @click="retryPull"
            >
              重試拉取（{{ pullRetryCount }}/{{ 3 }}）
            </el-button>
            <el-button v-else disabled>拉取已達重試上限</el-button>
            <el-button :disabled="!syncStatus.available" @click="pull">重新拉取</el-button>
          </template>
          <template v-else-if="pullState === 'success'">
            <el-button :disabled="!syncStatus.available" @click="pull">再次拉取</el-button>
          </template>
        </div>
      </template>

      <el-empty v-else description="載入中…" :image-size="40" />
    </el-card>

    <!-- 推送輸出 -->
    <el-card v-if="pushLogLines.length || isPushRunning" shadow="never" style="margin-bottom:16px">
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px">
          <span>推送輸出</span>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            <template v-if="pushTraceId">
              <span style="font-size:12px; color:#909399">traceId: {{ pushTraceId }}</span>
              <span style="font-size:12px; color:#909399">重試: {{ pushRetryCount }}/{{ 3 }}</span>
              <el-button size="small" @click="copyPushTraceId">複製 traceId</el-button>
            </template>
            <el-button v-if="pushLogLines.length > 0" size="small" @click="copyPushLog">複製完整記錄</el-button>
          </div>
        </div>
      </template>

      <el-progress
        v-if="isPushRunning || pushSse.done.value"
        :percentage="pushSse.progress.value"
        :status="pushSse.done.value ? (pushSse.success.value ? 'success' : 'exception') : undefined"
        style="margin-bottom:12px"
      />

      <div
        v-if="pushSse.done.value && pushLogLines.length > 0"
        style="display:flex; gap:8px; margin-bottom:12px"
      >
        <el-tag type="success">成功 {{ pushSuccessCount }}</el-tag>
        <el-tag type="warning">警告 {{ pushWarnCount }}</el-tag>
        <el-tag type="danger">失敗 {{ pushErrorCount }}</el-tag>
      </div>

      <div ref="pushLogContainer" class="action-log" :style="logStyle">
        <div v-if="pushLogLines.length === 0" style="color:#666">等待輸出…</div>
        <div
          v-for="(line, i) in pushLogLines"
          :key="i"
          :style="{ color: lineColor(line) }"
        >{{ line }}</div>
      </div>

      <el-alert
        v-if="pushSse.errorMsg.value"
        :title="pushSse.errorMsg.value"
        type="error"
        show-icon
        :closable="false"
        style="margin-top:8px"
      />
    </el-card>

    <!-- 拉取輸出 -->
    <el-card v-if="pullLogLines.length || isPullRunning" shadow="never">
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px">
          <span>拉取輸出</span>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            <template v-if="pullTraceId">
              <span style="font-size:12px; color:#909399">traceId: {{ pullTraceId }}</span>
              <span style="font-size:12px; color:#909399">重試: {{ pullRetryCount }}/{{ 3 }}</span>
              <el-button size="small" @click="copyPullTraceId">複製 traceId</el-button>
            </template>
            <el-button v-if="pullLogLines.length > 0" size="small" @click="copyPullLog">複製完整記錄</el-button>
          </div>
        </div>
      </template>

      <el-progress
        v-if="isPullRunning || pullSse.done.value"
        :percentage="pullSse.progress.value"
        :status="pullSse.done.value ? (pullSse.success.value ? 'success' : 'exception') : undefined"
        style="margin-bottom:12px"
      />

      <div
        v-if="pullSse.done.value && pullLogLines.length > 0"
        style="display:flex; gap:8px; margin-bottom:12px"
      >
        <el-tag type="success">成功 {{ pullSuccessCount }}</el-tag>
        <el-tag type="warning">警告 {{ pullWarnCount }}</el-tag>
        <el-tag type="danger">失敗 {{ pullErrorCount }}</el-tag>
      </div>

      <div ref="pullLogContainer" class="action-log" :style="logStyle">
        <div v-if="pullLogLines.length === 0" style="color:#666">等待輸出…</div>
        <div
          v-for="(line, i) in pullLogLines"
          :key="i"
          :style="{ color: lineColor(line) }"
        >{{ line }}</div>
      </div>

      <el-alert
        v-if="pullSse.errorMsg.value"
        :title="pullSse.errorMsg.value"
        type="error"
        show-icon
        :closable="false"
        style="margin-top:8px"
      />
    </el-card>
  </div>
</template>
