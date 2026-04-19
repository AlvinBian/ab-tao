import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
	history: createWebHashHistory(),
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
					component: () => import("@/views/OverviewView.vue"),
				},
				{ path: "hooks", component: () => import("@/views/HooksView.vue") },
				{ path: "state", component: () => import("@/views/StateView.vue") },
				{ path: "memory", component: () => import("@/views/MemoryView.vue") },
				{ path: "mcp", component: () => import("@/views/McpView.vue") },
				{ path: "repos", component: () => import("@/views/ReposView.vue") },
				{
					path: "techstacks",
					component: () => import("@/views/TechStacksView.vue"),
				},
				{
					path: "environment",
					component: () => import("@/views/EnvironmentView.vue"),
				},
				{
					path: "resources/skills",
					component: () => import("@/views/resources/SkillsView.vue"),
				},
				{
					path: "resources/commands",
					component: () => import("@/views/resources/CommandsView.vue"),
				},
				{
					path: "resources/agents",
					component: () => import("@/views/resources/AgentsView.vue"),
				},
				{
					path: "resources/rules",
					component: () => import("@/views/resources/RulesView.vue"),
				},
				{
					path: "config/permissions",
					component: () => import("@/views/config/PermissionsView.vue"),
				},
				{
					path: "config/hooks",
					component: () => import("@/views/config/HooksConfigView.vue"),
				},
				{
					path: "config/ai",
					component: () => import("@/views/config/AiModelView.vue"),
				},
				{
					path: "config/plugins",
					component: () => import("@/views/config/PluginsView.vue"),
				},
				{
					path: "config/preferences",
					component: () => import("@/views/config/PreferencesView.vue"),
				},
				{
					path: "actions/setup",
					component: () => import("@/views/actions/SetupWizardView.vue"),
				},
				{
					path: "actions/scan",
					component: () => import("@/views/actions/ScanView.vue"),
				},
				{
					path: "actions/sync",
					component: () => import("@/views/actions/SyncView.vue"),
				},
			],
		},
	],
});

export default router;
