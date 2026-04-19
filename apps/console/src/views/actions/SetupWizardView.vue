<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, ref } from "vue";
import ProgressWithLog from "@/components/ProgressWithLog.vue";
import { useSse } from "@/composables/useSse";

const session = ref<Record<string, unknown> | null>(null);
const loadingSession = ref(false);

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
		const { data } = await r.json();
		session.value = data && Object.keys(data).length > 0 ? data : null;
	} finally {
		loadingSession.value = false;
	}
});

async function execute() {
	await ElMessageBox.confirm(
		"d:setup 會修改 ~/.claude/ 的配置文件，執行前已自動備份。\n確定繼續？",
		"確認執行 d:setup",
		{ confirmButtonText: "執行", cancelButtonText: "取消", type: "warning" },
	);
	sse.reset();
	sse.start("/api/setup/execute", { flags: [] });
}

async function cancel() {
	sse.stop();
	await fetch("/api/setup/execute", { method: "DELETE" });
	ElMessage.info("已發送取消訊號");
}

async function clearProgress() {
	await fetch("/api/setup/progress", { method: "DELETE" });
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

    <!-- 七階段流程 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>安裝流程（七階段）</span></template>
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
