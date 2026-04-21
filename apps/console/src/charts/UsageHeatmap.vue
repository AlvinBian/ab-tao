<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import type { ECOption } from "./types";

const props = defineProps<{
	dailyCounts: Record<string, number>;
	year?: number;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => Object.keys(props.dailyCounts ?? {}).length > 0);

const targetYear = computed(() => props.year ?? new Date().getFullYear());

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const data = Object.entries(props.dailyCounts).map(([date, count]) => [
		date,
		count,
	]);
	const maxCount = Math.max(...Object.values(props.dailyCounts), 1);

	return {
		tooltip: {
			formatter: (p: unknown) => {
				const params = p as { data: [string, number] };
				return `${params.data[0]}：${params.data[1]} sessions`;
			},
		},
		visualMap: {
			min: 0,
			max: maxCount,
			type: "continuous",
			orient: "horizontal",
			left: "center",
			bottom: 0,
			inRange: {
				color: ["var(--el-fill-color-light)", "var(--el-color-primary)"],
			},
			textStyle: { color: "var(--el-text-color-regular)", fontSize: 11 },
		},
		calendar: {
			top: 30,
			left: 50,
			right: 10,
			cellSize: [14, 14],
			range: String(targetYear.value),
			itemStyle: {
				borderWidth: 1,
				borderColor: "var(--el-border-color-lighter)",
			},
			yearLabel: { show: false },
			monthLabel: { color: "var(--el-text-color-secondary)", fontSize: 11 },
			dayLabel: { color: "var(--el-text-color-secondary)", fontSize: 10 },
		},
		series: [
			{
				type: "heatmap",
				coordinateSystem: "calendar",
				data,
				emphasis: { itemStyle: { borderColor: "var(--el-color-primary)" } },
			},
		],
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="!hasData" description="無使用記錄" :image-size="40" />
  <v-chart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
