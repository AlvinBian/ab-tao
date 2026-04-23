<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { DayUsage } from "@/stores/status";
import type { ECOption } from "./types";

const MODEL_COLORS = [
	"#409eff",
	"#67c23a",
	"#e6a23c",
	"#f56c6c",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
	"#3498db",
];

const props = defineProps<{
	data: DayUsage[] | null;
	allModels: string[];
	loading?: boolean;
	error?: string | null;
	/** tokens（inputTokens+outputTokens）或 requests */
	dimension?: "tokens" | "requests";
	/** 顯示哪些 model（空陣列 = 全部） */
	visibleModels?: string[];
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 340}px`);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isEmpty(d: unknown): boolean {
	return (
		d == null ||
		(Array.isArray(d) && d.length === 0) ||
		(typeof d === "object" &&
			!Array.isArray(d) &&
			Object.keys(d as object).length === 0)
	);
}

const labelSecondary = useElCssVar("--el-text-color-secondary", "#909399");
const labelRegular = useElCssVar("--el-text-color-regular", "#606266");
const splitLine = useElCssVar("--el-border-color-lighter", "#ebeef5");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const rows = props.data ?? [];
	const dim = props.dimension ?? "tokens";
	const visible = new Set(
		props.visibleModels?.length ? props.visibleModels : props.allModels,
	);
	const models = props.allModels.filter((m) => visible.has(m));
	const days = rows.map((r) => r.day);

	const series = models.map((model, idx) => ({
		name: model,
		type: "bar" as const,
		stack: "total",
		data: rows.map((r) => {
			const slot = r.models[model];
			if (!slot) return 0;
			return dim === "tokens"
				? slot.inputTokens + slot.outputTokens
				: slot.requests;
		}),
		itemStyle: {
			color: MODEL_COLORS[idx % MODEL_COLORS.length],
		},
		emphasis: { focus: "series" as const },
	}));

	return {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "shadow" },
			formatter(params: unknown) {
				if (!Array.isArray(params)) return "";
				const day = (params[0] as { axisValue: string }).axisValue;
				let html = `<b>${day}</b><br/>`;
				for (const p of params as Array<{
					seriesName: string;
					value: number;
					color: string;
				}>) {
					if (p.value === 0) continue;
					html += `<span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:4px"></span>${p.seriesName}: <b>${p.value.toLocaleString()}</b><br/>`;
				}
				return html;
			},
		},
		legend: {
			top: 4,
			textStyle: { fontSize: 11, color: labelRegular.value },
			itemWidth: 12,
			itemHeight: 8,
		},
		grid: { left: 60, right: 20, top: 44, bottom: 50 },
		xAxis: {
			type: "category",
			data: days,
			axisLabel: {
				color: labelRegular.value,
				fontSize: 10,
				rotate: days.length > 14 ? 30 : 0,
			},
		},
		yAxis: {
			type: "value",
			minInterval: 1,
			axisLabel: {
				color: labelSecondary.value,
				fontSize: 11,
				formatter: (v: number) =>
					v >= 1000000
						? `${(v / 1000000).toFixed(1)}M`
						: v >= 1000
							? `${(v / 1000).toFixed(0)}K`
							: String(v),
			},
			splitLine: { lineStyle: { color: splitLine.value } },
		},
		series,
		dataZoom:
			days.length > 30
				? [{ type: "slider", bottom: 8, height: 20, start: 70, end: 100 }]
				: undefined,
	};
});
</script>

<template>
  <el-skeleton v-if="loading" :rows="4" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="isEmpty(data)" description="暫無資料" :image-size="40" />
  <v-chart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
