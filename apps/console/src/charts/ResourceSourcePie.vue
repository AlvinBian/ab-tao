<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	resources: Array<{ name: string; source?: string }>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const primary = useElCssVar("--el-color-primary", "#409eff");
const success = useElCssVar("--el-color-success", "#67c23a");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const info = useElCssVar("--el-color-info", "#909399");

const palette = [
	() => primary.value,
	() => success.value,
	() => warning.value,
	() => info.value,
];

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => (props.resources?.length ?? 0) > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const counts = new Map<string, number>();
	for (const r of props.resources ?? []) {
		const src = r.source ?? "未知";
		counts.set(src, (counts.get(src) ?? 0) + 1);
	}
	const entries = [...counts.entries()].sort(([, a], [, b]) => b - a);
	const data = entries.map(([src, count], i) => ({
		name: src,
		value: count,
		itemStyle: { color: palette[i % palette.length]() },
	}));
	return {
		tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
		legend: { bottom: 0, textStyle: { fontSize: 10 }, type: "scroll" },
		series: [
			{
				type: "pie",
				radius: ["40%", "68%"],
				center: ["50%", "43%"],
				data,
				label: { formatter: "{b}: {c}", fontSize: 11 },
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
  <el-empty v-else description="無資源資料" :image-size="40" />
</template>
