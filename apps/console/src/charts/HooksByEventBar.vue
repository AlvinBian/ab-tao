<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	hooks: ReadonlyArray<{
		event: string;
		exists: boolean;
		executable: boolean;
	}>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const successColor = useElCssVar("--el-color-success", "#67c23a");
const dangerColor = useElCssVar("--el-color-danger", "#f56c6c");
const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const grouped = new Map<string, { healthy: number; unhealthy: number }>();
	for (const h of props.hooks ?? []) {
		const key = h.event || "unknown";
		const bucket = grouped.get(key) ?? { healthy: 0, unhealthy: 0 };
		if (h.exists && h.executable) bucket.healthy += 1;
		else bucket.unhealthy += 1;
		grouped.set(key, bucket);
	}
	const events = [...grouped.keys()].reverse();
	const healthy = events.map((e) => grouped.get(e)?.healthy ?? 0);
	const unhealthy = events.map((e) => grouped.get(e)?.unhealthy ?? 0);

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		legend: { top: 0, textStyle: { fontSize: 11 } },
		grid: { left: 130, right: 20, top: 30, bottom: 30 },
		xAxis: {
			type: "value",
			axisLabel: { color: labelSecondary.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		yAxis: {
			type: "category",
			data: events,
			axisLabel: {
				color: labelRegular.value,
				fontSize: 11,
				width: 120,
				overflow: "truncate",
			},
		},
		series: [
			{
				name: "Healthy",
				type: "bar",
				stack: "total",
				itemStyle: { color: successColor.value },
				barMaxWidth: 16,
				data: healthy,
			},
			{
				name: "Unhealthy",
				type: "bar",
				stack: "total",
				itemStyle: { color: dangerColor.value },
				barMaxWidth: 16,
				data: unhealthy,
			},
		],
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hooks.length > 0">
    <v-chart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
    />
  </template>
  <el-empty v-else description="無 Hook 資料" :image-size="40" />
</template>
