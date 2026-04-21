<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	managed: Record<string, { source?: string }>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const primary = useElCssVar("--el-color-primary", "#409eff");
const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => Object.keys(props.managed ?? {}).length > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const counts = new Map<string, number>();
	for (const entry of Object.values(props.managed ?? {})) {
		const src = entry.source ?? "未知";
		counts.set(src, (counts.get(src) ?? 0) + 1);
	}
	const sorted = [...counts.entries()].sort(([, a], [, b]) => b - a);
	const names = sorted.map(([k]) => k).reverse();
	const values = sorted.map(([, v]) => v).reverse();

	return {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		grid: { left: 160, right: 20, top: 10, bottom: 30 },
		xAxis: {
			type: "value",
			axisLabel: { color: labelSecondary.value, fontSize: 11 },
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		yAxis: {
			type: "category",
			data: names,
			axisLabel: {
				color: labelRegular.value,
				fontSize: 11,
				width: 150,
				overflow: "truncate",
			},
		},
		series: [
			{
				type: "bar",
				data: values,
				itemStyle: { color: primary.value, borderRadius: [0, 4, 4, 0] },
				barMaxWidth: 20,
				label: { show: true, position: "right", fontSize: 11 },
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
  <el-empty v-else description="無 Managed 檔案" :image-size="40" />
</template>
