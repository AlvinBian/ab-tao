<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { getCategoryColor } from "./categoryColors";
import type { ECOption } from "./types";

const props = defineProps<{
	stacks: Record<string, string[]>;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const children = Object.entries(props.stacks)
		.filter(([, techs]) => techs.length > 0)
		.map(([category, techs]) => ({
			name: category,
			itemStyle: { color: getCategoryColor(category) },
			children: techs.slice(0, 15).map((t) => ({
				name: t,
				value: 1,
			})),
		}));

	return {
		tooltip: { trigger: "item", formatter: "{b}: {c}" },
		series: [
			{
				type: "sunburst",
				data: children,
				radius: ["10%", "90%"],
				label: {
					fontSize: 11,
					color: "var(--el-text-color-regular)",
					overflow: "truncate",
				},
				emphasis: {
					focus: "ancestor",
					itemStyle: { opacity: 0.9 },
				},
				levels: [
					{},
					{
						r0: "15%",
						r: "55%",
						label: { align: "right", fontSize: 12, fontWeight: 500 },
					},
					{
						r0: "55%",
						r: "88%",
						label: { position: "outside", fontSize: 10, padding: 3 },
					},
				],
			},
		],
	};
});
</script>

<template>
  <v-chart
    :option="option"
    :style="{ height: '380px', width: '100%' }"
    autoresize
  />
</template>
