<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	repos: Array<{ name: string; role?: string }>;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

const emit = defineEmits<{ filter: [role: string] }>();

const primary = useElCssVar("--el-color-primary", "#409eff");
const success = useElCssVar("--el-color-success", "#67c23a");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const danger = useElCssVar("--el-color-danger", "#f56c6c");
const info = useElCssVar("--el-color-info", "#909399");

const roleColors: Record<string, () => string> = {
	work: () => primary.value,
	personal: () => success.value,
	oss: () => warning.value,
	archived: () => info.value,
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => (props.repos?.length ?? 0) > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const counts = new Map<string, number>();
	for (const r of props.repos ?? []) {
		const role = r.role ?? "unknown";
		counts.set(role, (counts.get(role) ?? 0) + 1);
	}
	const data = [...counts.entries()].map(([role, count]) => ({
		name: role,
		value: count,
		itemStyle: { color: roleColors[role]?.() ?? danger.value },
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
			},
		],
	};
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleClick(params: { name: string }) {
	emit("filter", params.name);
}
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hasData">
    <v-chart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
      @click="handleClick"
    />
  </template>
  <el-empty v-else description="無 Repo 資料" :image-size="40" />
</template>
