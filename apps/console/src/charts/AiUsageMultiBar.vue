<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

interface AiUsageStat {
	model: string;
	requests: number;
	inputTokens: number;
	outputTokens: number;
	errors: number;
}

const props = defineProps<{
	data: AiUsageStat[] | null;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isEmpty(d: unknown): boolean {
	return (
		d == null ||
		(Array.isArray(d) && d.length === 0) ||
		(typeof d === "object" &&
			!Array.isArray(d) &&
			Object.keys(d as object).length === 0)
	);
}

const primary = useElCssVar("--el-color-primary", "#409eff");
const success = useElCssVar("--el-color-success", "#67c23a");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const danger = useElCssVar("--el-color-danger", "#f56c6c");
const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const rows = props.data ?? [];
	const models = rows.map((r) => r.model);

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		legend: { top: 0, textStyle: { fontSize: 11 } },
		grid: { left: 60, right: 20, top: 36, bottom: 50 },
		xAxis: {
			type: "category",
			data: models,
			axisLabel: {
				color: labelRegular.value,
				fontSize: 10,
				rotate: 20,
				width: 80,
				overflow: "truncate",
			},
		},
		yAxis: {
			type: "value",
			minInterval: 1,
			axisLabel: { color: labelSecondary.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		series: [
			{
				name: "Requests",
				type: "bar",
				data: rows.map((r) => r.requests),
				itemStyle: { color: primary.value, borderRadius: [4, 4, 0, 0] },
				barMaxWidth: 28,
			},
			{
				name: "Input Tokens",
				type: "bar",
				data: rows.map((r) => r.inputTokens),
				itemStyle: { color: success.value, borderRadius: [4, 4, 0, 0] },
				barMaxWidth: 28,
			},
			{
				name: "Output Tokens",
				type: "bar",
				data: rows.map((r) => r.outputTokens),
				itemStyle: { color: warning.value, borderRadius: [4, 4, 0, 0] },
				barMaxWidth: 28,
			},
			{
				name: "Errors",
				type: "bar",
				data: rows.map((r) => r.errors),
				itemStyle: { color: danger.value, borderRadius: [4, 4, 0, 0] },
				barMaxWidth: 28,
			},
		],
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="isEmpty(data)" description="暫無資料" :image-size="40" />
  <v-chart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
