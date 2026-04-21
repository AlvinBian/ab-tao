import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/",
			redirect: "/overview",
		},
		{
			path: "/",
			component: () => import("@/layouts/ConsoleLayout.vue"),
			children: [
				{
					path: "overview",
					name: "overview",
					meta: { title: "總覽" },
					component: () => import("@/views/OverviewView.vue"),
				},
				{
					path: "hooks",
					name: "hooks",
					meta: { title: "Hooks 健檢狀態" },
					component: () => import("@/views/HooksView.vue"),
				},
				{
					path: "state",
					name: "state",
					meta: { title: "State & Drift" },
					component: () => import("@/views/StateView.vue"),
				},
				{
					path: "memory",
					name: "memory",
					meta: { title: "Memory & Plans" },
					component: () => import("@/views/MemoryView.vue"),
				},
				{
					path: "mcp",
					name: "mcp",
					meta: { title: "MCP 伺服器" },
					component: () => import("@/views/McpView.vue"),
				},
				{
					path: "repos",
					name: "repos",
					meta: { title: "Repos" },
					component: () => import("@/views/ReposView.vue"),
				},
				{
					path: "techstacks",
					name: "techstacks",
					meta: { title: "技術棧" },
					component: () => import("@/views/TechStacksView.vue"),
				},
				{
					path: "environment",
					name: "environment",
					meta: { title: "環境資訊" },
					component: () => import("@/views/EnvironmentView.vue"),
				},
				{
					path: "resources/skills",
					name: "resources-skills",
					meta: { title: "Skills" },
					component: () => import("@/views/resources/SkillsView.vue"),
				},
				{
					path: "resources/commands",
					name: "resources-commands",
					meta: { title: "Commands" },
					component: () => import("@/views/resources/CommandsView.vue"),
				},
				{
					path: "resources/agents",
					name: "resources-agents",
					meta: { title: "Agents" },
					component: () => import("@/views/resources/AgentsView.vue"),
				},
				{
					path: "resources/rules",
					name: "resources-rules",
					meta: { title: "Rules" },
					component: () => import("@/views/resources/RulesView.vue"),
				},
				{
					path: "config/permissions",
					name: "config-permissions",
					meta: { title: "Permissions" },
					component: () => import("@/views/config/PermissionsView.vue"),
				},
				{
					path: "config/hooks",
					name: "config-hooks",
					meta: { title: "Hooks 啟用設定" },
					component: () => import("@/views/config/HooksConfigView.vue"),
				},
				{
					path: "config/ai",
					name: "config-ai",
					meta: { title: "AI 模型" },
					component: () => import("@/views/config/AiModelView.vue"),
				},
				{
					path: "config/plugins",
					name: "config-plugins",
					meta: { title: "Claude 擴充套件" },
					component: () => import("@/views/config/PluginsView.vue"),
				},
				{
					path: "config/preferences",
					name: "config-preferences",
					meta: { title: "偏好設定" },
					component: () => import("@/views/config/PreferencesView.vue"),
				},
				{
					path: "config/chrome",
					name: "config-chrome",
					meta: { title: "Chrome 優化" },
					component: () => import("@/views/config/ChromeView.vue"),
				},
				{
					path: "actions/setup",
					name: "actions-setup",
					meta: { title: "Setup 精靈" },
					component: () => import("@/views/actions/SetupWizardView.vue"),
				},
				{
					path: "actions/scan",
					name: "actions-scan",
					meta: { title: "技術棧掃描" },
					component: () => import("@/views/actions/ScanView.vue"),
				},
				{
					path: "actions/sync",
					name: "actions-sync",
					meta: { title: "Sync 同步" },
					component: () => import("@/views/actions/SyncView.vue"),
				},
				{
					path: "actions/restore",
					name: "actions-restore",
					meta: { title: "還原備份" },
					component: () => import("@/views/actions/RestoreView.vue"),
				},
			],
		},
	],
});

export default router;
