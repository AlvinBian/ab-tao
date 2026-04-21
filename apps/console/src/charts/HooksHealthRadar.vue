<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

interface HooksHealthData {
	event: string;
	exists: boolean;
	executable: boolean;
	enabledCount: number;
	coveragePct: number;
	errorRatePct: number;
}

const props = defineProps<{
	data: HooksHealthData[] | null;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

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
const info = useElCssVar("--el-color-info", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// 調色盤：每個 event 一個顏色
const palette = computed(() => [
	primary.value,
	success.value,
	warning.value,
	danger.value,
	info.value,
]);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const rows = props.data ?? [];

	return {
		tooltip: { trigger: "item" },
		legend: {
			bottom: 0,
			textStyle: { fontSize: 10 },
			type: "scroll",
		},
		radar: {
			indicator: [
				{ name: "Exists", max: 1 },
				{ name: "Executable", max: 1 },
				{
					name: "Enabled Count",
					max: Math.max(...rows.map((r) => r.enabledCount), 1),
				},
				{ name: "Coverage %", max: 100 },
				{ name: "Error Rate %", max: 100 },
			],
			axisName: { color: labelRegular.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
			splitArea: { show: false },
		},
		series: [
			{
				type: "radar",
				data: rows.map((r, i) => ({
					name: r.event,
					value: [
						r.exists ? 1 : 0,
						r.executable ? 1 : 0,
						r.enabledCount,
						r.coveragePct,
						r.errorRatePct,
					],
					lineStyle: {
						color: palette.value[i % palette.value.length],
						width: 2,
					},
					areaStyle: {
						color: palette.value[i % palette.value.length],
						opacity: 0.15,
					},
					itemStyle: { color: palette.value[i % palette.value.length] },
				})),
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
