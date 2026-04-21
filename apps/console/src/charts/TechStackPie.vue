<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { getCategoryColor } from "./categoryColors";
import type { ECOption } from "./types";

const props = defineProps<{ stacks: Record<string, string[]> }>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => ({
	tooltip: { trigger: "item", formatter: "{b}: {c} 項 ({d}%)" },
	legend: {
		orient: "vertical",
		left: "left",
		textStyle: { fontSize: 11 },
		type: "scroll",
	},
	series: [
		{
			type: "pie",
			radius: ["30%", "70%"],
			center: ["60%", "50%"],
			data: Object.entries(props.stacks)
				.filter(([, techs]) => techs.length > 0)
				.map(([cat, techs]) => ({
					name: cat,
					value: techs.length,
					itemStyle: { color: getCategoryColor(cat) },
				})),
			label: { fontSize: 11 },
			emphasis: {
				itemStyle: {
					shadowBlur: 10,
					shadowOffsetX: 0,
					shadowColor: "rgba(0,0,0,0.2)",
				},
			},
		},
	],
}));
</script>

<template>
  <v-chart :option="option" :style="{ height: '360px', width: '100%' }" autoresize />
</template>
