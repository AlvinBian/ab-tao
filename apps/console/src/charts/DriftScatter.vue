<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

interface DriftItem {
	path: string;
	decision?: string;
	/** drift 年齡（天數），由後端 detectDrift() 從 state.json installedAt 計算 */
	age: number;
	[key: string]: unknown;
}

const props = defineProps<{
	drift: DriftItem[];
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

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

const dangerColor = useElCssVar("--el-color-danger", "#f56c6c");
const warningColor = useElCssVar("--el-color-warning", "#e6a23c");
const successColor = useElCssVar("--el-color-success", "#67c23a");
const placeholderColor = useElCssVar("--el-text-color-placeholder", "#c0c4cc");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const decisions = [
		...new Set(props.drift.map((d) => d.decision ?? "unknown")),
	];
	const colorMap: Record<string, string> = {
		deleted: dangerColor.value,
		modified: warningColor.value,
		added: successColor.value,
		unknown: placeholderColor.value,
	};

	const series = decisions.map((dec) => ({
		name: dec,
		type: "scatter" as const,
		data: props.drift
			.filter((d) => (d.decision ?? "unknown") === dec)
			.map((d, i) => [i, d.age ?? 0, d.path]),
		symbolSize: 10,
		itemStyle: { color: colorMap[dec] ?? placeholderColor.value },
	}));

	return {
		tooltip: {
			trigger: "item",
			formatter: (p: unknown) => {
				const params = p as {
					data: [number, number, string];
					seriesName: string;
				};
				return `${params.data[2]}<br/>${params.seriesName}（${params.data[1] ?? 0} 天前）`;
			},
		},
		legend: {
			data: decisions,
			bottom: 0,
			textStyle: { color: "var(--el-text-color-regular)", fontSize: 11 },
		},
		grid: { left: 30, right: 20, top: 10, bottom: 36 },
		xAxis: { show: false },
		yAxis: {
			type: "value",
			name: "天數",
			nameTextStyle: { color: "var(--el-text-color-secondary)", fontSize: 11 },
			axisLabel: { color: "var(--el-text-color-secondary)", fontSize: 10 },
			splitLine: { lineStyle: { color: "var(--el-border-color-lighter)" } },
		},
		series,
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="isEmpty(drift)" description="無 Drift 資料" :image-size="40" />
  <v-chart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
