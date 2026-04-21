<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import { getCategoryColor } from "./categoryColors";
import type { ECOption } from "./types";

const props = defineProps<{
	stacks: Record<string, string[]>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => Object.keys(props.stacks ?? {}).length > 0);

const borderColor = useElCssVar("--el-border-color", "#dcdfe6");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => ({
	tooltip: {
		formatter: (params: unknown) => {
			const p = params as { name: string; value: number };
			return `${p.name}: ${p.value} 項`;
		},
	},
	series: [
		{
			type: "treemap",
			roam: false,
			nodeClick: false,
			breadcrumb: { show: false },
			data: Object.entries(props.stacks)
				.filter(([, techs]) => techs.length > 0)
				.map(([cat, techs]) => ({
					name: cat,
					value: techs.length,
					itemStyle: { color: getCategoryColor(cat) },
					children: techs.slice(0, 20).map((t) => ({ name: t, value: 1 })),
				})),
			label: { fontSize: 11 },
			upperLabel: { show: true, height: 24, fontSize: 12, fontWeight: 500 },
			levels: [
				{
					itemStyle: {
						borderWidth: 2,
						borderColor: "var(--el-bg-color-page)",
					},
					upperLabel: { show: true },
				},
				{
					itemStyle: { borderWidth: 1, borderColor: borderColor.value },
				},
			],
		},
	],
}));
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="!hasData" description="無技術棧資料" :image-size="40" />
  <v-chart v-else :option="option" :style="{ height: heightPx, width: '100%' }" autoresize />
</template>
