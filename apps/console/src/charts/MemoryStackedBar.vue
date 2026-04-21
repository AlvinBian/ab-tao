<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

interface ProjectMemory {
	encoded: string;
	memory: string[];
	plans: string[];
	tasks: string[];
}

const props = defineProps<{
	global:
		| { memory: string[]; plans: string[]; tasks: string[] }
		| null
		| undefined;
	projects: ProjectMemory[];
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const primary = useElCssVar("--el-color-primary", "#409eff");
const success = useElCssVar("--el-color-success", "#67c23a");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

function shortName(encoded: string): string {
	const last = encoded.split("-").filter(Boolean).pop() ?? encoded;
	return last.length > 20 ? `${last.slice(0, 18)}…` : last;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(
	() => (props.projects?.length ?? 0) > 0 || !!props.global,
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const rows: Array<{
		label: string;
		memory: number;
		plans: number;
		tasks: number;
	}> = [];
	if (props.global) {
		rows.push({
			label: "Global",
			memory: props.global.memory?.length ?? 0,
			plans: props.global.plans?.length ?? 0,
			tasks: props.global.tasks?.length ?? 0,
		});
	}
	for (const p of props.projects ?? []) {
		rows.push({
			label: shortName(p.encoded),
			memory: p.memory?.length ?? 0,
			plans: p.plans?.length ?? 0,
			tasks: p.tasks?.length ?? 0,
		});
	}
	rows.reverse();

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		legend: { top: 0, textStyle: { fontSize: 11 } },
		grid: { left: 100, right: 20, top: 30, bottom: 30 },
		xAxis: {
			type: "value",
			axisLabel: { color: labelSecondary.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		yAxis: {
			type: "category",
			data: rows.map((r) => r.label),
			axisLabel: {
				color: labelRegular.value,
				fontSize: 11,
				width: 90,
				overflow: "truncate",
			},
		},
		series: [
			{
				name: "Memory",
				type: "bar",
				stack: "total",
				itemStyle: { color: primary.value },
				barMaxWidth: 18,
				data: rows.map((r) => r.memory),
			},
			{
				name: "Plans",
				type: "bar",
				stack: "total",
				itemStyle: { color: success.value },
				barMaxWidth: 18,
				data: rows.map((r) => r.plans),
			},
			{
				name: "Tasks",
				type: "bar",
				stack: "total",
				itemStyle: { color: warning.value },
				barMaxWidth: 18,
				data: rows.map((r) => r.tasks),
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
  <el-empty v-else description="無 Memory 資料" :image-size="40" />
</template>
