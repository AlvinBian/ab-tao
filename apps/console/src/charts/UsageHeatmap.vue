<script setup lang="ts">
import { computed } from "vue";
import VChart from "vue-echarts";
import "@/charts/registry";
import type { ECOption } from "./types";

const props = defineProps<{
	dailyCounts: Record<string, number>;
	year?: number;
}>();

const targetYear = computed(() => props.year ?? new Date().getFullYear());

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
  <v-chart
    :option="option"
    :style="{ height: '140px', width: '100%' }"
    autoresize
  />
</template>
