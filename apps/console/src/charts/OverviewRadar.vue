<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	commandUsageRate: number;
	agentUsageRate: number;
	hookHealthRate: number;
	skillEnabledRate: number;
	envScore: number;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const primary = useElCssVar("--el-color-primary", "#409eff");
const fill = useElCssVar("--el-color-primary-light-7", "#c6e2ff");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => ({
	radar: {
		indicator: [
			{ name: "指令使用率", max: 100 },
			{ name: "Agent 使用率", max: 100 },
			{ name: "Hook 健康率", max: 100 },
			{ name: "Skill 啟用率", max: 100 },
			{ name: "環境分數", max: 100 },
		],
		axisName: { color: labelRegular.value, fontSize: 11 },
		splitLine: { lineStyle: { color: splitLine.value } },
		splitArea: { show: false },
	},
	series: [
		{
			type: "radar",
			data: [
				{
					value: [
						props.commandUsageRate,
						props.agentUsageRate,
						props.hookHealthRate,
						props.skillEnabledRate,
						props.envScore,
					],
					name: "健康指標",
					lineStyle: { color: primary.value, width: 2 },
					areaStyle: { color: fill.value, opacity: 0.4 },
					itemStyle: { color: primary.value },
				},
			],
		},
	],
}));
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <v-chart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
