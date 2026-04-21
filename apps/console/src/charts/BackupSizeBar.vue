<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	backups: Array<{ id: string; date?: string; fileCount?: number }>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const emit = defineEmits<{ select: [id: string] }>();

const primary = useElCssVar("--el-color-primary", "#409eff");
const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => (props.backups?.length ?? 0) > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const sorted = [...(props.backups ?? [])].slice(-12);
	const labels = sorted.map((b) => b.date?.slice(0, 10) ?? b.id.slice(0, 10));
	const values = sorted.map((b) => b.fileCount ?? 1);

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		grid: { left: 40, right: 20, top: 10, bottom: 50 },
		xAxis: {
			type: "category",
			data: labels,
			axisLabel: { color: labelRegular.value, fontSize: 10, rotate: 30 },
		},
		yAxis: {
			type: "value",
			minInterval: 1,
			axisLabel: { color: labelSecondary.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		series: [
			{
				type: "bar",
				data: values,
				itemStyle: { color: primary.value, borderRadius: [4, 4, 0, 0] },
				barMaxWidth: 32,
			},
		],
	};
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleClick(params: { dataIndex: number }) {
	const backup = props.backups?.[params.dataIndex];
	if (backup) emit("select", backup.id);
}
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hasData">
    <v-chart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
      @click="handleClick"
    />
  </template>
  <el-empty v-else description="無備份記錄" :image-size="40" />
</template>
