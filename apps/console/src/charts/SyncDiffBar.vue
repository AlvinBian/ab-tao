<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	synced: number;
	drift: number;
	unknown: number;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

const success = useElCssVar("--el-color-success", "#67c23a");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const info = useElCssVar("--el-color-info", "#909399");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => props.synced + props.drift + props.unknown > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => ({
	tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
	legend: { top: 0, textStyle: { fontSize: 11 } },
	grid: { left: 20, right: 20, top: 30, bottom: 20, containLabel: true },
	xAxis: { type: "value" },
	yAxis: { type: "category", data: ["同步狀態"], axisLabel: { show: false } },
	series: [
		{
			name: "已同步",
			type: "bar",
			stack: "total",
			data: [props.synced],
			itemStyle: { color: success.value },
			barMaxWidth: 24,
			label: {
				show: props.synced > 0,
				position: "inside",
				formatter: `{c}`,
				fontSize: 11,
			},
		},
		{
			name: "Drift",
			type: "bar",
			stack: "total",
			data: [props.drift],
			itemStyle: { color: warning.value },
			barMaxWidth: 24,
			label: {
				show: props.drift > 0,
				position: "inside",
				formatter: `{c}`,
				fontSize: 11,
			},
		},
		{
			name: "未知",
			type: "bar",
			stack: "total",
			data: [props.unknown],
			itemStyle: { color: info.value },
			barMaxWidth: 24,
			label: {
				show: props.unknown > 0,
				position: "inside",
				formatter: `{c}`,
				fontSize: 11,
			},
		},
	],
}));
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hasData">
    <v-chart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
    />
  </template>
  <el-empty v-else description="無同步資料" :image-size="40" />
</template>
