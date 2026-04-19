<script setup lang="ts">
import { computed } from "vue";
import VChart from "vue-echarts";
import "@/charts/registry";
import type { ECOption } from "./types";

const props = defineProps<{
	stacks: Record<string, string[]>;
}>();

// 顏色對應 13 個技術類別
const CATEGORY_COLORS: Record<string, string> = {
	Frontend: "#409EFF",
	Backend: "#67C23A",
	Mobile: "#E6A23C",
	DevOps: "#F56C6C",
	Database: "#909399",
	Testing: "#B0C4DE",
	Security: "#DC143C",
	AI_ML: "#9370DB",
	Infrastructure: "#20B2AA",
	"Desktop/Native": "#FF8C00",
	Blockchain: "#7B68EE",
	IoT: "#3CB371",
	Other: "#C0C0C0",
};

const option = computed<ECOption>(() => {
	const children = Object.entries(props.stacks)
		.filter(([, techs]) => techs.length > 0)
		.map(([category, techs]) => ({
			name: category,
			itemStyle: { color: CATEGORY_COLORS[category] ?? "#999" },
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
