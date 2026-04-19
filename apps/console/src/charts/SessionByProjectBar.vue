<script setup lang="ts">
import { computed } from "vue";
import VChart from "vue-echarts";
import "@/charts/registry";
import type { ECOption } from "./types";

const props = defineProps<{
	byProject: Record<string, number>;
	topN?: number;
}>();

const option = computed<ECOption>(() => {
	const sorted = Object.entries(props.byProject)
		.sort(([, a], [, b]) => b - a)
		.slice(0, props.topN ?? 8);

	const names = sorted.map(([k]) => k.split("/").pop() ?? k);
	const values = sorted.map(([, v]) => v);

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		grid: { left: 100, right: 20, top: 10, bottom: 30 },
		xAxis: {
			type: "value",
			axisLabel: { color: "var(--el-text-color-secondary)", fontSize: 11 },
			splitLine: { lineStyle: { color: "var(--el-border-color-lighter)" } },
		},
		yAxis: {
			type: "category",
			data: names.reverse(),
			axisLabel: {
				color: "var(--el-text-color-regular)",
				fontSize: 11,
				width: 90,
				overflow: "truncate",
			},
		},
		series: [
			{
				type: "bar",
				data: values.reverse(),
				itemStyle: { color: "var(--el-color-primary)" },
				barMaxWidth: 20,
			},
		],
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
