<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	servers: Array<{ name: string; type?: string }>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

const primary = useElCssVar("--el-color-primary", "#409eff");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const placeholderColor = useElCssVar("--el-text-color-placeholder", "#c0c4cc");

const typeColorMap = computed<Record<string, string>>(() => ({
	stdio: primary.value,
	sse: warning.value,
	unknown: placeholderColor.value,
}));

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const counts = new Map<string, number>();
	for (const s of props.servers ?? []) {
		const key = s.type || "unknown";
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const data = [...counts.entries()].map(([type, count]) => ({
		name: type,
		value: count,
		itemStyle: { color: typeColorMap.value[type] ?? placeholderColor.value },
	}));
	return {
		tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
		legend: { bottom: 0, textStyle: { fontSize: 11 } },
		series: [
			{
				type: "pie",
				radius: ["40%", "70%"],
				center: ["50%", "45%"],
				data,
				label: { formatter: "{b}: {c}", fontSize: 11 },
				emphasis: {
					itemStyle: {
						shadowBlur: 10,
						shadowOffsetX: 0,
						shadowColor: "rgba(0,0,0,0.2)",
					},
				},
			},
		],
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="servers.length > 0">
    <v-chart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
    />
  </template>
  <el-empty v-else description="無 MCP Server" :image-size="40" />
</template>
