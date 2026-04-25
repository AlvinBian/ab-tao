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
		rows: 3,
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
			{ id: "allpass", label: "環境檢查結果", type: "auto", row: 2, col: 1 },
			{
				id: "install",
				label: "依序安裝缺漏工具",
				type: "auto",
				row: 2,
				col: 2,
			},
			{
				id: "migrate",
				label: "NodeMgr 遷移策略",
				type: "auto",
				row: 2,
				col: 3,
			},
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
			["rtk", "allpass"],
			["allpass", "install"],
			["install", "migrate"],
			["allpass", "migrate"],
		],
	},
	// 1: 功能選擇
	{
		rows: 4,
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
			{
				id: "claude_feat",
				label: "Claude Code配置",
				type: "parallel",
				row: 3,
				col: 0,
			},
			{ id: "proj_feat", label: "專案配置", type: "parallel", row: 3, col: 2 },
			{
				id: "zsh_feat",
				label: "ZSH環境模組",
				type: "parallel",
				row: 3,
				col: 4,
			},
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
			["topo", "claude_feat"],
			["topo", "proj_feat"],
			["topo", "zsh_feat"],
		],
	},
	// 2: 技術棧分析
	{
		rows: 3,
		nodes: [
			{
				id: "account",
				label: "GitHub 帳號",
				type: "interactive",
				row: 0,
				col: 0,
			},
			{ id: "repos", label: "選擇Repos", type: "interactive", row: 0, col: 1 },
			{ id: "local", label: "本地路徑掃描", type: "auto", row: 0, col: 2 },
			{
				id: "techdetect",
				label: "多生態技術偵測",
				type: "auto",
				row: 0,
				col: 3,
			},
			{ id: "contribs", label: "貢獻分析", type: "auto", row: 1, col: 0 },
			{ id: "role", label: "角色分配", type: "interactive", row: 1, col: 1 },
			{ id: "ai", label: "AI技術棧分析", type: "auto", row: 1, col: 2 },
			{ id: "roledetect", label: "角色判定", type: "auto", row: 2, col: 0 },
			{ id: "match", label: "AI資源匹配", type: "auto", row: 2, col: 1 },
			{
				id: "profile",
				label: "生成開發者畫像",
				type: "output",
				row: 2,
				col: 2,
			},
		],
		edges: [
			["account", "repos"],
			["repos", "local"],
			["local", "techdetect"],
			["repos", "contribs"],
			["contribs", "role"],
			["local", "ai"],
			["techdetect", "match"],
			["role", "roledetect"],
			["roledetect", "profile"],
			["ai", "match"],
			["match", "profile"],
		],
	},
	// 3: AI 資源同步
	{
		rows: 2,
		nodes: [
			{ id: "config", label: "讀取來源清單", type: "auto", row: 0, col: 0 },
			{ id: "ver", label: "版本快取檢查", type: "auto", row: 0, col: 1 },
			{
				id: "cache_check",
				label: "TTL 有效性驗證",
				type: "auto",
				row: 0,
				col: 2,
			},
			{
				id: "select",
				label: "多選AI來源",
				type: "interactive",
				row: 0,
				col: 3,
			},
			{ id: "batch_dl", label: "批次下載資源", type: "auto", row: 1, col: 1 },
			{ id: "ai_filter", label: "AI精選推薦", type: "auto", row: 1, col: 2 },
			{ id: "sync", label: "寫入 ~/.claude/", type: "output", row: 1, col: 3 },
		],
		edges: [
			["config", "ver"],
			["ver", "cache_check"],
			["cache_check", "select"],
			["select", "batch_dl"],
			["batch_dl", "ai_filter"],
			["ai_filter", "sync"],
		],
	},
	// 4: 確認計畫
	{
		rows: 3,
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
			{ id: "install_all", label: "安裝全部", type: "auto", row: 1, col: 0 },
			{ id: "detail", label: "逐項確認", type: "interactive", row: 1, col: 2 },
			{ id: "minimal", label: "精簡安裝", type: "optional", row: 1, col: 3 },
			{
				id: "adjust",
				label: "逐類調整（可選）",
				type: "optional",
				row: 2,
				col: 1,
			},
			{ id: "confirm", label: "最終確認", type: "output", row: 2, col: 2 },
		],
		edges: [
			["tech", "cmdmd"],
			["cmdmd", "star"],
			["star", "ailist"],
			["ailist", "instmod"],
			["instmod", "install_all"],
			["instmod", "detail"],
			["instmod", "minimal"],
			["install_all", "confirm"],
			["detail", "adjust"],
			["adjust", "confirm"],
			["minimal", "confirm"],
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
			{
				id: "claudeHud",
				label: "claude-hud狀態列",
				type: "parallel",
				row: 1,
				col: 3,
			},
			{ id: "aiwrite", label: "AI資源寫入", type: "auto", row: 2, col: 0 },
			{ id: "skills", label: "Skills同步", type: "auto", row: 2, col: 1 },
			{ id: "verify", label: "驗證安裝", type: "output", row: 2, col: 2 },
		],
		edges: [
			["bkup", "claude"],
			["bkup", "plugins"],
			["bkup", "zsh"],
			["bkup", "claudeHud"],
			["claude", "aiwrite"],
			["plugins", "aiwrite"],
			["zsh", "aiwrite"],
			["claudeHud", "aiwrite"],
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
