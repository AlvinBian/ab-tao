<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
// biome-ignore lint/correctness/noUnusedImports: used in template
import SettingRow from "@/components/SettingRow.vue";
import { useActionState } from "@/composables/useActionState";
import { useSse } from "@/composables/useSse";
import { useStatusStore } from "@/stores/status";

const route = useRoute();
const selectedRepo = ref<string | null>(null);

const statusStore = useStatusStore();
onMounted(() => {
	statusStore.fetchData();
	const repoParam = route.query.repo;
	if (typeof repoParam === "string" && repoParam) {
		selectedRepo.value = repoParam;
	}
});

const cachedStacks = computed(() => statusStore.data?.cachedTechStacks ?? {});
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasStacks = computed(() => Object.keys(cachedStacks.value).length > 0);

const scanOptions = ref({
	init: false,
	noAi: false,
	org: "",
	top: "",
	skills: "",
});

const dryRun = ref(false);

const action = useActionState();
// biome-ignore lint/correctness/noUnusedVariables: used in template
const { isRunning, isFailed, retryExhausted, MAX_RETRIES } = action;

// 記錄
const logLines = ref<string[]>([]);
const logContainer = ref<HTMLElement | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const successCount = computed(
	() =>
		logLines.value.filter((l) =>
			/(^|[\s[(])(✓|success|PASS)([\s:.\])]|$)/i.test(l),
		).length,
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const warnCount = computed(
	() =>
		logLines.value.filter((l) => /(^|[\s[(])(⚠|warn)([\s:.\])]|$)/i.test(l))
			.length,
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const errorCount = computed(
	() =>
		logLines.value.filter((l) =>
			/(^|[\s[(])(✗|error|FAIL)([\s:.\])]|$)/i.test(l),
		).length,
);

const sse = useSse({
	onDone: (e) => {
		action.settle(e.success ?? false);
		if (e.success) {
			ElMessage.success("掃描完成");
		} else {
			ElMessage.error("掃描失敗");
		}
	},
});

watch(
	() => sse.logs.value.length,
	() => {
		logLines.value = sse.logs.value.map((l) => l.message);
		nextTick(() => {
			if (logContainer.value) {
				logContainer.value.scrollTop = logContainer.value.scrollHeight;
			}
		});
	},
);

function buildBody() {
	const body: Record<string, unknown> = { ...scanOptions.value };
	if (!body.org) delete body.org;
	if (!body.top) delete body.top;
	if (!body.skills) delete body.skills;
	if (body.top) body.top = Number(body.top);
	if (dryRun.value) body.dryRun = true;
	if (selectedRepo.value) body.repo = selectedRepo.value;
	return body;
}

function runScan() {
	logLines.value = [];
	const url = dryRun.value ? "/api/scan?dryRun=true" : "/api/scan";
	sse.start(url, buildBody());
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function startScan() {
	action.start();
	runScan();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function retryScan() {
	if (!action.retry()) return;
	runScan();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function cancelScan() {
	sse.stop();
	await fetch("/api/scan", { method: "DELETE" });
	action.reset();
	ElMessage.info("已發送取消訊號");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyLog() {
	await navigator.clipboard.writeText(logLines.value.join("\n"));
	ElMessage.success("已複製完整記錄");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function copyTraceId() {
	await navigator.clipboard.writeText(action.traceId.value);
	ElMessage.success("已複製 traceId");
}
</script>

<template>
  <div>
    <!-- 從 Repos 頁面跳轉預填 -->
    <el-alert
      v-if="selectedRepo"
      :title="`將限定掃描：${selectedRepo}`"
      type="info"
      show-icon
      :closable="true"
      style="margin-bottom:16px"
      @close="selectedRepo = null"
    />

    <!-- Dry-run 警告橫幅 -->
    <el-alert
      v-if="dryRun"
      title="Dry-run 模式：不會實際寫入變更"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom:16px"
    />

    <!-- 掃描選項 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>掃描選項</span></template>
      <el-form label-width="120px" label-position="left" size="small" style="max-width:540px">
        <SettingRow label="重建模式" description="--init：清空 stacks/ 後重新生成，適合首次掃描或資料不一致時使用。">
          <el-switch v-model="scanOptions.init" :disabled="isRunning" />
        </SettingRow>
        <SettingRow label="停用 AI 生成" description="跳過 AI 摘要生成步驟，僅做靜態分析；大型 repo 可先用此模式快速預覽結果。">
          <el-switch v-model="scanOptions.noAi" :disabled="isRunning" />
        </SettingRow>
        <SettingRow label="GitHub Org" description="指定 GitHub 組織名稱，掃描 org 下的 repos（需有相應存取權限）。">
          <el-input v-model="scanOptions.org" placeholder="--org（選填）" clearable :disabled="isRunning" />
        </SettingRow>
        <SettingRow label="掃描數量" description="限制掃描的 repo 數量，測試用；留空則掃描全部。">
          <el-input v-model="scanOptions.top" placeholder="--top N（選填）" clearable :disabled="isRunning" />
        </SettingRow>
        <SettingRow label="指定技術棧" description="指定要分析的技術棧（逗號分隔）；留空則自動偵測所有技術棧。">
          <el-input v-model="scanOptions.skills" placeholder="typescript,vue（選填，逗號分隔）" clearable :disabled="isRunning" />
        </SettingRow>

        <!-- Dry-run 切換 -->
        <el-form-item label="Dry-run">
          <el-switch v-model="dryRun" active-text="Dry-run 預覽" :disabled="isRunning" />
        </el-form-item>

        <el-form-item>
          <el-button
            v-if="!isRunning && action.state.value === 'idle'"
            type="primary"
            @click="startScan"
          >
            開始掃描
          </el-button>
          <el-button
            v-else-if="isRunning"
            type="danger"
            @click="cancelScan"
          >
            取消掃描
          </el-button>
          <template v-else-if="isFailed">
            <el-button
              v-if="!retryExhausted"
              type="warning"
              @click="retryScan"
            >
              重試（{{ action.retryCount.value }}/{{ MAX_RETRIES }}）
            </el-button>
            <el-button v-else disabled>已達重試上限</el-button>
            <el-button type="primary" @click="startScan">重新開始</el-button>
          </template>
          <el-button
            v-else-if="action.state.value === 'success'"
            type="primary"
            @click="startScan"
          >
            再次掃描
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 執行進度 -->
    <el-card v-if="action.state.value !== 'idle' || logLines.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px">
          <span>掃描輸出</span>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            <!-- traceId -->
            <template v-if="action.traceId.value">
              <span style="font-size:12px; color:#909399">traceId: {{ action.traceId.value }}</span>
              <span style="font-size:12px; color:#909399">重試: {{ action.retryCount.value }}/{{ MAX_RETRIES }}</span>
              <el-button size="small" @click="copyTraceId">複製 traceId</el-button>
            </template>
            <el-button
              v-if="logLines.length > 0"
              size="small"
              @click="copyLog"
            >
              複製完整記錄
            </el-button>
          </div>
        </div>
      </template>

      <!-- 進度條 -->
      <el-progress
        v-if="isRunning || sse.done.value"
        :percentage="sse.progress.value"
        :status="sse.done.value ? (sse.success.value ? 'success' : 'exception') : undefined"
        style="margin-bottom:12px"
      />

      <!-- 結果分類標籤 -->
      <div
        v-if="sse.done.value && logLines.length > 0"
        style="display:flex; gap:8px; margin-bottom:12px"
      >
        <el-tag type="success">成功 {{ successCount }}</el-tag>
        <el-tag type="warning">警告 {{ warnCount }}</el-tag>
        <el-tag type="danger">失敗 {{ errorCount }}</el-tag>
      </div>

      <!-- 記錄輸出 -->
      <div
        ref="logContainer"
        class="action-log"
        :style="{ height: '380px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', background: '#1e1e1e', color: '#d4d4d4', padding: '8px', borderRadius: '4px' }"
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

      <!-- 錯誤訊息 -->
      <el-alert
        v-if="sse.errorMsg.value"
        :title="sse.errorMsg.value"
        type="error"
        show-icon
        :closable="false"
        style="margin-top:8px"
      />
    </el-card>

    <!-- 上次掃描快取（技術棧分佈 Treemap）-->
    <el-card v-if="hasStacks" shadow="never">
      <template #header><span>上次掃描快取（技術棧分佈）</span></template>
      <ScanResultTreemap :stacks="cachedStacks" />
    </el-card>
  </div>
</template>
