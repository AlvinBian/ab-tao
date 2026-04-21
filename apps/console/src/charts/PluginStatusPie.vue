<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{
	total: number;
	enabled: number;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

const heightPx = computed(() => `${props.height ?? 320}px`);

const success = useElCssVar("--el-color-success", "#67c23a");
const border = useElCssVar("--el-border-color", "#dcdfe6");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasData = computed(() => props.total > 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const disabled = Math.max(0, props.total - props.enabled);
	return {
		tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
		series: [
			{
				type: "pie",
				radius: ["50%", "75%"],
				center: ["50%", "50%"],
				data: [
					{
						name: "啟用",
						value: props.enabled,
						itemStyle: { color: success.value },
					},
					{ name: "停用", value: disabled, itemStyle: { color: border.value } },
				],
				label: {
					show: true,
					position: "center",
					formatter: () => `${props.enabled}/${props.total}`,
					fontSize: 16,
					fontWeight: "bold",
				},
				emphasis: { label: { show: true } },
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
  <el-empty v-else description="無 Plugin 資料" :image-size="40" />
</template>
