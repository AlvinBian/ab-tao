<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { getCategoryColor } from "./categoryColors";
import type { ECOption } from "./types";

const props = defineProps<{ stacks: Record<string, string[]> }>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const sorted = Object.entries(props.stacks)
		.filter(([, t]) => t.length > 0)
		.sort(([, a], [, b]) => b.length - a.length);
	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		grid: { left: 110, right: 30, top: 10, bottom: 30 },
		xAxis: { type: "value", axisLabel: { fontSize: 11 } },
		yAxis: {
			type: "category",
			data: sorted.map(([cat]) => cat).reverse(),
			axisLabel: { fontSize: 11, width: 100, overflow: "truncate" },
		},
		series: [
			{
				type: "bar",
				data: sorted
					.map(([cat, techs]) => ({
						value: techs.length,
						itemStyle: {
							color: getCategoryColor(cat),
							borderRadius: [0, 4, 4, 0] as [number, number, number, number],
						},
					}))
					.reverse(),
				barMaxWidth: 20,
				label: { show: true, position: "right", fontSize: 10 },
			},
		],
	};
});
</script>

<template>
  <v-chart :option="option" :style="{ height: '360px', width: '100%' }" autoresize />
</template>
