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
		name: string;
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
const primaryColor = useElCssVar("--el-color-primary", "#409eff");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => (props.hooks?.length ?? 0) > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const nodeSet = new Set<string>();
	const linkMap = new Map<string, number>();

	for (const h of props.hooks ?? []) {
		const status = h.exists && h.executable ? "健康" : "異常";
		nodeSet.add(h.event);
		nodeSet.add(h.name);
		nodeSet.add(status);
		const key = `${h.event}|${h.name}`;
		linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
		const key2 = `${h.name}|${status}`;
		linkMap.set(key2, (linkMap.get(key2) ?? 0) + 1);
	}

	const nodes = [...nodeSet].map((name) => ({
		name,
		itemStyle: {
			color:
				name === "健康"
					? successColor.value
					: name === "異常"
						? dangerColor.value
						: primaryColor.value,
		},
	}));

	const links = [...linkMap.entries()].map(([key, value]) => {
		const [source, target] = key.split("|");
		return { source, target, value };
	});

	return {
		tooltip: { trigger: "item", triggerOn: "mousemove" },
		series: [
			{
				type: "sankey",
				data: nodes,
				links,
				emphasis: { focus: "adjacency" },
				lineStyle: { color: "gradient", curveness: 0.5 },
				label: { fontSize: 11 },
				nodeWidth: 16,
				nodeGap: 8,
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
  <el-empty v-else description="無 Hook 資料" :image-size="40" />
</template>
