<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref, watch } from "vue";
import { useSettingsStore } from "@/stores/settings";

const store = useSettingsStore();
onMounted(() => store.fetchSettings());

const model = ref("");
const effortLevel = ref("");
const dirty = ref(false);

const MODEL_OPTIONS = [
	{ label: "Opus 4 (claude-opus-4-5)", value: "claude-opus-4-5" },
	{ label: "Sonnet 4 (claude-sonnet-4-5)", value: "claude-sonnet-4-5" },
	{ label: "Haiku 4 (claude-haiku-4-5)", value: "claude-haiku-4-5-20251001" },
	{ label: "opusplan（Opus 計畫模式）", value: "opusplan" },
];

const EFFORT_OPTIONS = [
	{ label: "最高（xhigh）", value: "xhigh" },
	{ label: "高（high）", value: "high" },
	{ label: "中（medium）", value: "medium" },
	{ label: "低（low）", value: "low" },
];

watch(
	() => store.settings,
	(s) => {
		if (!s) return;
		model.value = s.model ?? "";
		effortLevel.value = s.effortLevel ?? "";
		dirty.value = false;
	},
	{ immediate: true },
);

function onChange() {
	dirty.value = true;
}

async function save() {
	try {
		await store.patchAi(model.value, effortLevel.value);
		dirty.value = false;
		ElMessage.success("AI 設定已儲存");
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "儲存失敗");
	}
}

function reset() {
	if (!store.settings) return;
	model.value = store.settings.model ?? "";
	effortLevel.value = store.settings.effortLevel ?? "";
	dirty.value = false;
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <el-alert
      v-if="dirty"
      title="有未儲存的變更"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom:16px"
    />

    <el-card shadow="never" style="max-width:600px">
      <template #header><span>AI 模型設定</span></template>

      <el-form label-width="120px" label-position="left">
        <el-form-item label="預設模型">
          <el-select v-model="model" placeholder="選擇模型" clearable @change="onChange">
            <el-option
              v-for="opt in MODEL_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
            <el-option :label="`自訂：${model}`" :value="model" v-if="model && !MODEL_OPTIONS.find(o => o.value === model)" />
          </el-select>
          <el-input
            v-model="model"
            placeholder="或直接輸入模型 ID"
            size="small"
            style="margin-top:6px"
            @input="onChange"
            clearable
          />
        </el-form-item>

        <el-form-item label="Effort Level">
          <el-radio-group v-model="effortLevel" @change="onChange">
            <el-radio-button v-for="opt in EFFORT_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <div style="text-align:right; margin-top:16px; display:flex; gap:8px; justify-content:flex-end">
        <el-button @click="reset" :disabled="!dirty">還原</el-button>
        <el-button type="primary" :loading="store.saving" @click="save" :disabled="!dirty">
          儲存
        </el-button>
      </div>
    </el-card>
  </div>
</template>
