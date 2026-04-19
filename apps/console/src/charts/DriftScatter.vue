<script setup lang="ts">
import { computed } from "vue";
import VChart from "vue-echarts";
import "@/charts/registry";
import type { ECOption } from "./types";

interface DriftItem {
	path: string;
	decision?: string;
	age?: number;
	[key: string]: unknown;
}

const props = defineProps<{
	drift: DriftItem[];
}>();

const option = computed<ECOption>(() => {
	const decisions = [
		...new Set(props.drift.map((d) => d.decision ?? "unknown")),
	];
	const colorMap: Record<string, string> = {
		deleted: "#F56C6C",
		modified: "#E6A23C",
		added: "#67C23A",
		unknown: "#909399",
	};

	const series = decisions.map((dec) => ({
		name: dec,
		type: "scatter" as const,
		data: props.drift
			.filter((d) => (d.decision ?? "unknown") === dec)
			.map((d, i) => [i, d.age ?? 0, d.path]),
		symbolSize: 10,
		itemStyle: { color: colorMap[dec] ?? "#999" },
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
  <v-chart
    :option="option"
    :style="{ height: '240px', width: '100%' }"
    autoresize
  />
</template>
