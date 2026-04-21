<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import SettingRow from "@/components/SettingRow.vue";
import { useSse } from "@/composables/useSse";

const session = ref<Record<string, unknown> | null>(null);
const loadingSession = ref(false);
const dryRun = ref(false);
const mode = ref<"quick" | "manual" | "all">("quick");
const fromIcloud = ref(false);
const selectedStep = ref(0);
const userInteracted = ref(false);

const sse = useSse({
	onDone: (e) => {
		if (e.success) ElMessage.success("d:setup 執行完成");
		else ElMessage.error("d:setup 執行失敗");
	},
});

const SETUP_STEPS = [
	{ title: "環境檢查", description: "doctor + 備份" },
	{ title: "功能選擇", description: "選擇要安裝的功能" },
	{ title: "技術棧分析", description: "掃描 repos" },
	{ title: "AI 資源同步", description: "選擇來源" },
	{ title: "確認計畫", description: "預覽變更" },
	{ title: "執行安裝", description: "部署所有資源" },
	{ title: "完成", description: "驗證結果" },
];

function activeStep() {
	if (!sse.running.value && !sse.done.value) return 0;
	if (sse.done.value) return SETUP_STEPS.length - 1;
	return Math.min(
		Math.floor((sse.progress.value / 100) * (SETUP_STEPS.length - 1)),
		SETUP_STEPS.length - 2,
	);
}

onMounted(async () => {
	loadingSession.value = true;
	try {
		const r = await fetch("/api/setup/session");
		const { code, message, data } = await r.json();
		if (code !== 0) {
			ElMessage.error(message ?? "無法載入 Session 記錄");
			return;
		}
		session.value = data && Object.keys(data).length > 0 ? data : null;
	} catch {
		ElMessage.error("無法載入 Session 記錄");
	} finally {
		loadingSession.value = false;
	}
});

watch(
	() => activeStep(),
	(v) => {
		if (!userInteracted.value) selectedStep.value = v;
	},
);

watch(sse.done, (done) => {
	if (done) {
		setTimeout(() => {
			userInteracted.value = false;
		}, 5000);
	}
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function execute() {
	await ElMessageBox.confirm(
		"d:setup 會修改 ~/.claude/ 的配置文件，執行前已自動備份。\n確定繼續？",
		"確認執行 d:setup",
		{ confirmButtonText: "執行", cancelButtonText: "取消", type: "warning" },
	);
	sse.reset();
	sse.start("/api/setup/execute", {
		flags: [],
		dryRun: dryRun.value,
		mode: mode.value,
		fromIcloud: fromIcloud.value,
	});
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function cancel() {
	sse.stop();
	const r = await fetch("/api/setup/execute", { method: "DELETE" });
	const { code, message } = await r.json();
	if (code !== 0) {
		ElMessage.error(message ?? "取消失敗");
		return;
	}
	ElMessage.info("已發送取消訊號");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const setupPhases = computed(() => {
	const active = activeStep();
	return SETUP_STEPS.map((step, i) => ({
		name: step.title,
		status: (i < active
			? "done"
			: i === active
				? sse.done.value
					? sse.success.value
						? "done"
						: "failed"
					: sse.running.value
						? "running"
						: "pending"
				: "pending") as "done" | "running" | "pending" | "failed",
		deps: i > 0 ? [SETUP_STEPS[i - 1].title] : undefined,
	}));
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const currentPhaseName = computed(() =>
	sse.running.value ? SETUP_STEPS[activeStep()]?.title : undefined,
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function clearProgress() {
	const r = await fetch("/api/setup/progress", { method: "DELETE" });
	const { code, message } = await r.json();
	if (code !== 0) {
		ElMessage.error(message ?? "清除進度失敗");
		return;
	}
	ElMessage.success("斷點進度已清除");
	session.value = null;
}
</script>

<template>
  <div>
    <!-- 斷點進度提示 -->
    <el-card
      v-if="session?.progress"
      shadow="never"
      style="margin-bottom:16px"
    >
      <template #header>
        <span>斷點續裝進度</span>
        <el-button
          size="small"
          type="danger"
          plain
          style="margin-left:8px"
          @click="clearProgress"
        >
          清除進度
        </el-button>
      </template>
      <el-descriptions :column="3" size="small" border>
        <el-descriptions-item label="上次階段">
          {{ (session.progress as Record<string,unknown>)?.lastPhase ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="已完成">
          {{ ((session.progress as Record<string,unknown>)?.completedTargets as unknown[])?.length ?? 0 }} 個
        </el-descriptions-item>
        <el-descriptions-item label="待安裝">
          {{ ((session.progress as Record<string,unknown>)?.pendingTargets as unknown[])?.length ?? 0 }} 個
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 七階段流程 + 各步驟子任務流程圖 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>安裝流程（七階段）</span>
        <span style="color:var(--el-text-color-secondary);font-size:12px;margin-left:8px">
          點選步驟查看詳細流程
        </span>
      </template>

      <el-steps
        :active="activeStep()"
        finish-status="success"
        align-center
        style="padding:16px 0"
      >
        <el-step
          v-for="step in SETUP_STEPS"
          :key="step.title"
          :title="step.title"
          :description="step.description"
        />
      </el-steps>

      <!-- 步驟選擇器 -->
      <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;padding:4px 0 12px">
        <el-tag
          v-for="(step, i) in SETUP_STEPS"
          :key="step.title"
          :effect="selectedStep === i ? 'dark' : 'plain'"
          :type="selectedStep === i ? undefined : 'info'"
          size="small"
          style="cursor:pointer;user-select:none"
          @click="selectedStep = i; userInteracted = true"
        >
          {{ i + 1 }}. {{ step.title }}
        </el-tag>
      </div>

      <el-divider style="margin:0 0 12px">
        <span style="font-size:12px;color:var(--el-text-color-secondary)">
          {{ SETUP_STEPS[selectedStep].title }} — 子任務流程
        </span>
      </el-divider>

      <!-- 圖例 -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;padding:0 8px">
        <span style="display:flex;align-items:center;gap:4px;font-size:11px">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--el-color-info)"/>
          自動執行
        </span>
        <span style="display:flex;align-items:center;gap:4px;font-size:11px">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--el-color-primary)"/>
          需要互動
        </span>
        <span style="display:flex;align-items:center;gap:4px;font-size:11px">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--el-color-warning)"/>
          並行執行
        </span>
        <span style="display:flex;align-items:center;gap:4px;font-size:11px">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--el-fill-color-darker)"/>
          可選
        </span>
        <span style="display:flex;align-items:center;gap:4px;font-size:11px">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--el-color-success)"/>
          產出
        </span>
      </div>

      <SetupStepFlowDiagram :step-index="selectedStep" />
    </el-card>

    <!-- 安裝選項 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>安裝選項</span></template>
      <el-form label-width="100px" size="small">
        <SettingRow
          label="模式"
          description="Quick = 自動套用推薦設定；Manual = 逐步確認每個選項；All = 安裝全部可用功能。"
        >
          <el-radio-group v-model="mode">
            <el-radio-button value="quick">Quick（快速）</el-radio-button>
            <el-radio-button value="manual">Manual（逐步確認）</el-radio-button>
            <el-radio-button value="all">All（全量）</el-radio-button>
          </el-radio-group>
        </SettingRow>
        <SettingRow label="Dry-run" description="只預覽變更，不實際寫入；確認無誤後再正式執行。">
          <el-switch v-model="dryRun" />
        </SettingRow>
        <SettingRow label="從 iCloud" description="從 iCloud 快速重建配置，適合換機或重裝後恢復個人設定。">
          <el-switch v-model="fromIcloud" />
        </SettingRow>
      </el-form>
    </el-card>

    <!-- 階段 DAG -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>階段依賴視覺化</span></template>
      <SetupPhaseDag :phases="setupPhases" :current-phase="currentPhaseName" />
    </el-card>

    <!-- 執行控制 + 進度 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>執行輸出</span>
        <span style="margin-left:8px">
          <el-button
            v-if="!sse.running.value"
            type="primary"
            size="small"
            :loading="loadingSession"
            @click="execute"
          >
            執行 d:setup
          </el-button>
          <el-button
            v-else
            type="danger"
            size="small"
            @click="cancel"
          >
            取消
          </el-button>
        </span>
      </template>

      <ProgressWithLog
        :running="sse.running.value"
        :done="sse.done.value"
        :success="sse.success.value"
        :progress="sse.progress.value"
        :stage="sse.stage.value"
        :logs="sse.logs.value"
        :error-msg="sse.errorMsg.value"
        log-height="320px"
      />
    </el-card>

    <!-- 上次 Session 摘要 -->
    <el-card v-if="session" shadow="never">
      <template #header><span>上次 Session 記錄</span></template>
      <el-descriptions :column="2" size="small" border>
        <el-descriptions-item label="Mode">{{ session.mode ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="Repos">
          {{ (session.repos as unknown[])?.length ?? 0 }} 個
        </el-descriptions-item>
        <el-descriptions-item label="Tech Categories">
          {{ (session.techCategories as string[])?.join(', ') || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="AI Res 選擇">
          {{ (session.aiResSelections as unknown[])?.length ?? 0 }} 個
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>
