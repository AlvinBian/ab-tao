<script setup lang="ts">
import { ElMessage } from "element-plus";
import { ref } from "vue";
import ProgressWithLog from "@/components/ProgressWithLog.vue";
import { useSse } from "@/composables/useSse";

const scanOptions = ref({
	init: false,
	noAi: false,
	org: "",
	top: "",
	skills: "",
});

const sse = useSse({
	onDone: (e) => {
		if (e.success) ElMessage.success("掃描完成");
		else ElMessage.error("掃描失敗");
	},
});

function startScan() {
	sse.reset();
	const body: Record<string, unknown> = { ...scanOptions.value };
	if (!body.org) delete body.org;
	if (!body.top) delete body.top;
	if (!body.skills) delete body.skills;
	if (body.top) body.top = Number(body.top);
	sse.start("/api/scan", body);
}

async function cancelScan() {
	sse.stop();
	await fetch("/api/scan", { method: "DELETE" });
	ElMessage.info("已發送取消訊號");
}
</script>

<template>
  <div>
    <!-- 掃描選項 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>掃描選項</span></template>
      <el-form label-width="120px" label-position="left" size="small" style="max-width:540px">
        <el-form-item label="重建模式">
          <el-switch v-model="scanOptions.init" />
          <span style="margin-left:8px; color:var(--el-text-color-secondary); font-size:12px">
            --init：清空 stacks/ 後重新生成
          </span>
        </el-form-item>
        <el-form-item label="停用 AI 生成">
          <el-switch v-model="scanOptions.noAi" />
        </el-form-item>
        <el-form-item label="GitHub Org">
          <el-input v-model="scanOptions.org" placeholder="--org（選填）" clearable />
        </el-form-item>
        <el-form-item label="掃描數量">
          <el-input v-model="scanOptions.top" placeholder="--top N（選填）" clearable />
        </el-form-item>
        <el-form-item label="指定技術棧">
          <el-input v-model="scanOptions.skills" placeholder="typescript,vue（選填，逗號分隔）" clearable />
        </el-form-item>
        <el-form-item>
          <el-button
            v-if="!sse.running.value"
            type="primary"
            @click="startScan"
          >
            開始掃描
          </el-button>
          <el-button
            v-else
            type="danger"
            @click="cancelScan"
          >
            取消掃描
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 執行進度 -->
    <el-card shadow="never">
      <template #header><span>掃描輸出</span></template>
      <ProgressWithLog
        :running="sse.running.value"
        :done="sse.done.value"
        :success="sse.success.value"
        :progress="sse.progress.value"
        :stage="sse.stage.value"
        :logs="sse.logs.value"
        :error-msg="sse.errorMsg.value"
        log-height="380px"
      />
    </el-card>
  </div>
</template>
