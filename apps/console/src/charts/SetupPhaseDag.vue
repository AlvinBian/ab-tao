<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	phases: Array<{
		name: string;
		status: "done" | "running" | "pending" | "failed";
		deps?: string[];
	}>;
	currentPhase?: string;
}>();

const success = useElCssVar("--el-color-success", "#67c23a");
const primary = useElCssVar("--el-color-primary", "#409eff");
const info = useElCssVar("--el-color-info", "#909399");
const danger = useElCssVar("--el-color-danger", "#f56c6c");
const textColor = useElCssVar("--el-text-color-regular", "#606266");
const borderColor = useElCssVar("--el-border-color", "#ccc");

const statusColor: Record<string, () => string> = {
	done: () => success.value,
	running: () => primary.value,
	pending: () => info.value,
	failed: () => danger.value,
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => (props.phases?.length ?? 0) > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const phases = props.phases ?? [];
	const n = Math.max(phases.length, 1);

	// 固定水平位置：均勻分佈在 50–950 的座標空間，ECharts graph layout:none 會自動 fit viewport
	const nodes = phases.map((p, i) => ({
		id: p.name,
		name: p.name,
		x: n === 1 ? 500 : (i / (n - 1)) * 900 + 50,
		y: 150,
		symbolSize: p.name === props.currentPhase ? 36 : 28,
		itemStyle: { color: statusColor[p.status]?.() ?? info.value },
		label: { color: textColor.value, fontSize: 10 },
		category: p.status,
	}));

	const links: Array<{ source: string; target: string }> = [];
	for (const p of phases) {
		for (const dep of p.deps ?? []) {
			links.push({ source: dep, target: p.name });
		}
	}

	return {
		tooltip: {
			formatter: (params: unknown) => {
				const p = params as { data?: { name?: string; category?: string } };
				return `${p.data?.name ?? ""} (${p.data?.category ?? ""})`;
			},
		},
		series: [
			{
				type: "graph",
				layout: "none",
				roam: false,
				data: nodes,
				links,
				categories: [
					{ name: "done", itemStyle: { color: success.value } },
					{ name: "running", itemStyle: { color: primary.value } },
					{ name: "pending", itemStyle: { color: info.value } },
					{ name: "failed", itemStyle: { color: danger.value } },
				],
				lineStyle: { color: borderColor.value, curveness: 0.1 },
				label: {
					show: true,
					position: "bottom",
					fontSize: 11,
					color: textColor.value,
				},
				edgeSymbol: ["none", "arrow"],
				edgeSymbolSize: 8,
			},
		],
	};
});
</script>

<template>
  <v-chart
    v-if="hasData"
    :option="option"
    :style="{ height: '280px', width: '100%' }"
    autoresize
  />
  <el-empty v-else description="無 Phase 資料" :image-size="40" />
</template>
