<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	choices: Array<{ path: string; decision: string }>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const primary = useElCssVar("--el-color-primary", "#409eff");
const info = useElCssVar("--el-color-info", "#909399");
const warning = useElCssVar("--el-color-warning", "#e6a23c");

const decisionColor: Record<string, () => string> = {
	install: () => primary.value,
	skip: () => info.value,
	merge: () => warning.value,
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => (props.choices?.length ?? 0) > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const counts = new Map<string, number>();
	for (const c of props.choices ?? []) {
		counts.set(c.decision, (counts.get(c.decision) ?? 0) + 1);
	}
	const data = [...counts.entries()].map(([dec, count]) => ({
		name: dec,
		value: count,
		itemStyle: { color: decisionColor[dec]?.() ?? info.value },
	}));
	return {
		tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
		legend: { bottom: 0, textStyle: { fontSize: 11 } },
		series: [
			{
				type: "pie",
				radius: ["35%", "65%"],
				center: ["50%", "45%"],
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
  <el-empty v-else description="無安裝選擇記錄" :image-size="40" />
</template>
