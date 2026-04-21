<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import SettingRow from "@/components/SettingRow.vue";
import { useSse } from "@/composables/useSse";
import { useStatusStore } from "@/stores/status";

const statusStore = useStatusStore();
onMounted(() => statusStore.fetchData());

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

const sse = useSse({
	onDone: (e) => {
		if (e.success) ElMessage.success("掃描完成");
		else ElMessage.error("掃描失敗");
	},
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function startScan() {
	sse.reset();
	const body: Record<string, unknown> = { ...scanOptions.value };
	if (!body.org) delete body.org;
	if (!body.top) delete body.top;
	if (!body.skills) delete body.skills;
	if (body.top) body.top = Number(body.top);
	sse.start("/api/scan", body);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
        <SettingRow label="重建模式" description="--init：清空 stacks/ 後重新生成，適合首次掃描或資料不一致時使用。">
          <el-switch v-model="scanOptions.init" />
        </SettingRow>
        <SettingRow label="停用 AI 生成" description="跳過 AI 摘要生成步驟，僅做靜態分析；大型 repo 可先用此模式快速預覽結果。">
          <el-switch v-model="scanOptions.noAi" />
        </SettingRow>
        <SettingRow label="GitHub Org" description="指定 GitHub 組織名稱，掃描 org 下的 repos（需有相應存取權限）。">
          <el-input v-model="scanOptions.org" placeholder="--org（選填）" clearable />
        </SettingRow>
        <SettingRow label="掃描數量" description="限制掃描的 repo 數量，測試用；留空則掃描全部。">
          <el-input v-model="scanOptions.top" placeholder="--top N（選填）" clearable />
        </SettingRow>
        <SettingRow label="指定技術棧" description="指定要分析的技術棧（逗號分隔）；留空則自動偵測所有技術棧。">
          <el-input v-model="scanOptions.skills" placeholder="typescript,vue（選填，逗號分隔）" clearable />
        </SettingRow>
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
    <el-card shadow="never" style="margin-bottom:16px">
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

    <!-- 上次掃描快取（技術棧分佈 Treemap）-->
    <el-card v-if="hasStacks" shadow="never">
      <template #header><span>上次掃描快取（技術棧分佈）</span></template>
      <ScanResultTreemap :stacks="cachedStacks" />
    </el-card>
  </div>
</template>
