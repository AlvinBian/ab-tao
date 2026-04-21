<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	allow: string[];
	deny: string[];
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

const success = useElCssVar("--el-color-success", "#67c23a");
const danger = useElCssVar("--el-color-danger", "#f56c6c");
const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

function categorize(tools: string[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const t of tools) {
		const cat = t.split("(")[0] || "Other";
		m.set(cat, (m.get(cat) ?? 0) + 1);
	}
	return m;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(
	() => (props.allow?.length ?? 0) + (props.deny?.length ?? 0) > 0,
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const allowMap = categorize(props.allow ?? []);
	const denyMap = categorize(props.deny ?? []);
	const allCats = [...new Set([...allowMap.keys(), ...denyMap.keys()])]
		.sort()
		.reverse();

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		legend: { top: 0, textStyle: { fontSize: 11 } },
		grid: { left: 100, right: 20, top: 30, bottom: 20 },
		xAxis: {
			type: "value",
			minInterval: 1,
			axisLabel: { color: labelSecondary.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		yAxis: {
			type: "category",
			data: allCats,
			axisLabel: {
				color: labelRegular.value,
				fontSize: 11,
				width: 90,
				overflow: "truncate",
			},
		},
		series: [
			{
				name: "Allow",
				type: "bar",
				stack: "total",
				data: allCats.map((c) => allowMap.get(c) ?? 0),
				itemStyle: { color: success.value },
				barMaxWidth: 20,
			},
			{
				name: "Deny",
				type: "bar",
				stack: "total",
				data: allCats.map((c) => denyMap.get(c) ?? 0),
				itemStyle: { color: danger.value },
				barMaxWidth: 20,
			},
		],
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hasData">
    <v-chart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
    />
  </template>
  <el-empty v-else description="無權限設定" :image-size="40" />
</template>
