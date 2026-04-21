<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import VChart from "vue-echarts";
import "@/charts/registry";
import { useElCssVar } from "@/composables/useElCssVar";
import type { ECOption } from "./types";

const props = defineProps<{ stepIndex: number }>();

const primary = useElCssVar("--el-color-primary", "#409eff");
const success = useElCssVar("--el-color-success", "#67c23a");
const warning = useElCssVar("--el-color-warning", "#e6a23c");
const info = useElCssVar("--el-color-info", "#909399");
const fillColorDarker = useElCssVar("--el-fill-color-darker", "#b8c0cc");
const borderColor = useElCssVar("--el-border-color", "#c0c4cc");

type NodeType = "auto" | "interactive" | "parallel" | "optional" | "output";

interface FlowNode {
	id: string;
	label: string;
	type: NodeType;
	row: number;
	col: number;
}
interface StepFlow {
	nodes: FlowNode[];
	edges: [string, string][];
	rows: number;
}

const FLOWS: StepFlow[] = [
	// 0: 環境檢查
	{
		rows: 2,
		nodes: [
			{ id: "backup", label: "原始備份", type: "auto", row: 0, col: 0 },
			{ id: "brew", label: "Homebrew", type: "auto", row: 0, col: 1 },
			{ id: "nodemgr", label: "Node版本管理", type: "auto", row: 0, col: 2 },
			{ id: "nodejs", label: "Node.js", type: "auto", row: 0, col: 3 },
			{ id: "pnpm", label: "pnpm", type: "auto", row: 0, col: 4 },
			{ id: "gh", label: "gh CLI", type: "auto", row: 1, col: 0 },
			{ id: "ghauth", label: "gh auth", type: "interactive", row: 1, col: 1 },
			{ id: "claude", label: "claude CLI", type: "auto", row: 1, col: 2 },
			{ id: "rtk", label: "RTK（可選）", type: "optional", row: 1, col: 3 },
		],
		edges: [
			["backup", "brew"],
			["brew", "nodemgr"],
			["nodemgr", "nodejs"],
			["nodejs", "pnpm"],
			["pnpm", "gh"],
			["gh", "ghauth"],
			["ghauth", "claude"],
			["claude", "rtk"],
		],
	},
	// 1: 功能選擇
	{
		rows: 3,
		nodes: [
			{ id: "sess", label: "讀取上次Session", type: "auto", row: 0, col: 1 },
			{ id: "mode", label: "模式選擇", type: "interactive", row: 0, col: 2 },
			{ id: "quick", label: "Quick：套用上次", type: "auto", row: 1, col: 0 },
			{
				id: "manual",
				label: "Manual：多選UI",
				type: "interactive",
				row: 1,
				col: 2,
			},
			{ id: "all", label: "All：全量選擇", type: "auto", row: 1, col: 4 },
			{ id: "dep", label: "依賴展開", type: "auto", row: 2, col: 1 },
			{ id: "topo", label: "拓撲排序", type: "output", row: 2, col: 3 },
		],
		edges: [
			["sess", "mode"],
			["mode", "quick"],
			["mode", "manual"],
			["mode", "all"],
			["quick", "dep"],
			["manual", "dep"],
			["all", "dep"],
			["dep", "topo"],
		],
	},
	// 2: 技術棧分析
	{
		rows: 2,
		nodes: [
			{ id: "repos", label: "選擇Repos", type: "interactive", row: 0, col: 0 },
			{ id: "role", label: "角色分配", type: "interactive", row: 0, col: 1 },
			{ id: "local", label: "本地路徑掃描", type: "auto", row: 0, col: 2 },
			{ id: "ai", label: "AI技術棧分析", type: "auto", row: 1, col: 0 },
			{ id: "match", label: "AI資源匹配", type: "auto", row: 1, col: 1 },
			{
				id: "profile",
				label: "生成開發者畫像",
				type: "output",
				row: 1,
				col: 2,
			},
		],
		edges: [
			["repos", "role"],
			["role", "local"],
			["local", "ai"],
			["ai", "match"],
			["match", "profile"],
		],
	},
	// 3: AI 資源同步
	{
		rows: 1,
		nodes: [
			{ id: "config", label: "讀取來源清單", type: "auto", row: 0, col: 0 },
			{ id: "ver", label: "檢查本地版本", type: "auto", row: 0, col: 1 },
			{
				id: "select",
				label: "多選AI來源",
				type: "interactive",
				row: 0,
				col: 2,
			},
			{ id: "sync", label: "下載同步", type: "output", row: 0, col: 3 },
		],
		edges: [
			["config", "ver"],
			["ver", "select"],
			["select", "sync"],
		],
	},
	// 4: 確認計畫
	{
		rows: 2,
		nodes: [
			{ id: "tech", label: "技術棧展示", type: "interactive", row: 0, col: 0 },
			{
				id: "cmdmd",
				label: "CLAUDE.md預覽",
				type: "interactive",
				row: 0,
				col: 1,
			},
			{
				id: "star",
				label: "星級門檻選擇",
				type: "interactive",
				row: 0,
				col: 2,
			},
			{
				id: "ailist",
				label: "AI資源清單",
				type: "interactive",
				row: 0,
				col: 3,
			},
			{
				id: "instmod",
				label: "安裝模式選擇",
				type: "interactive",
				row: 1,
				col: 1,
			},
			{
				id: "adjust",
				label: "逐類調整（可選）",
				type: "optional",
				row: 1,
				col: 2,
			},
			{ id: "confirm", label: "最終確認", type: "output", row: 1, col: 3 },
		],
		edges: [
			["tech", "cmdmd"],
			["cmdmd", "star"],
			["star", "ailist"],
			["ailist", "instmod"],
			["instmod", "adjust"],
			["adjust", "confirm"],
		],
	},
	// 5: 執行安裝
	{
		rows: 3,
		nodes: [
			{ id: "bkup", label: "備份現有配置", type: "auto", row: 0, col: 1 },
			{
				id: "claude",
				label: "claude-base部署",
				type: "parallel",
				row: 1,
				col: 0,
			},
			{ id: "plugins", label: "Plugins安裝", type: "parallel", row: 1, col: 1 },
			{ id: "zsh", label: "ZSH模組部署", type: "parallel", row: 1, col: 2 },
			{ id: "aiwrite", label: "AI資源寫入", type: "auto", row: 2, col: 0 },
			{ id: "skills", label: "Skills同步", type: "auto", row: 2, col: 1 },
			{ id: "verify", label: "驗證安裝", type: "output", row: 2, col: 2 },
		],
		edges: [
			["bkup", "claude"],
			["bkup", "plugins"],
			["bkup", "zsh"],
			["claude", "aiwrite"],
			["plugins", "aiwrite"],
			["zsh", "aiwrite"],
			["aiwrite", "skills"],
			["skills", "verify"],
		],
	},
	// 6: 完成
	{
		rows: 2,
		nodes: [
			{ id: "summary", label: "安裝摘要", type: "auto", row: 0, col: 0 },
			{ id: "guide", label: "Quick Start", type: "auto", row: 0, col: 1 },
			{ id: "rtk", label: "RTK增強提示", type: "optional", row: 0, col: 2 },
			{ id: "report", label: "生成HTML報告", type: "auto", row: 1, col: 0 },
			{ id: "sess", label: "儲存Session", type: "auto", row: 1, col: 1 },
			{ id: "open", label: "開啟報告", type: "output", row: 1, col: 2 },
		],
		edges: [
			["summary", "guide"],
			["guide", "rtk"],
			["rtk", "report"],
			["report", "sess"],
			["sess", "open"],
		],
	},
];

const COL_W = 170;
const ROW_H = 90;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const option = computed<ECOption>(() => {
	const flow = FLOWS[props.stepIndex] ?? FLOWS[0];

	const typeColor: Record<NodeType, () => string> = {
		auto: () => info.value,
		interactive: () => primary.value,
		parallel: () => warning.value,
		optional: () => fillColorDarker.value,
		output: () => success.value,
	};

	const nodes = flow.nodes.map((n) => ({
		id: `s${props.stepIndex}-${n.id}`,
		name: n.label,
		x: n.col * COL_W + 85,
		y: n.row * ROW_H + 44,
		symbol: "roundRect",
		symbolSize: [144, 36],
		itemStyle: { color: typeColor[n.type](), borderWidth: 0 },
		label: {
			show: true,
			color: "#fff",
			fontSize: 11,
			fontWeight: "bold" as const,
		},
	}));

	const links = flow.edges.map(([source, target]) => ({
		source: `s${props.stepIndex}-${source}`,
		target: `s${props.stepIndex}-${target}`,
	}));

	return {
		tooltip: { show: false },
		series: [
			{
				type: "graph",
				layout: "none",
				roam: false,
				data: nodes,
				links,
				lineStyle: { color: borderColor.value, width: 1.5, curveness: 0.05 },
				edgeSymbol: ["none", "arrow"],
				edgeSymbolSize: 8,
				label: { show: true },
			},
		],
	};
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const chartHeight = computed(() => {
	const flow = FLOWS[props.stepIndex] ?? FLOWS[0];
	return `${flow.rows * ROW_H + 88}px`;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const chartMinWidth = computed(() => {
	const flow = FLOWS[props.stepIndex] ?? FLOWS[0];
	const maxCol = Math.max(...flow.nodes.map((n) => n.col), 0);
	return `${(maxCol + 1) * COL_W + 100}px`;
});
</script>

<template>
  <div :style="{ overflowX: 'auto' }">
    <v-chart
      :option="option"
      :style="{ height: chartHeight, minWidth: chartMinWidth, width: '100%' }"
      autoresize
    />
  </div>
</template>
