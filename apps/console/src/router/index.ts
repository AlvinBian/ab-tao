import {
	createRouter,
	createWebHistory,
	type RouteLocationGeneric,
} from "vue-router";

// ── 舊路由向後相容映射（24 條）────────────────────────────────────────────────
const REDIRECT_MAP: Record<string, { path: string; tab: string }> = {
	"/overview": { path: "/dashboard", tab: "overview" },
	"/state": { path: "/dashboard", tab: "state" },
	"/environment": { path: "/dashboard", tab: "environment" },
	"/stats": { path: "/dashboard", tab: "stats" },
	"/token-stats": { path: "/dashboard", tab: "stats" },
	"/worklog": { path: "/dashboard", tab: "worklog" },
	"/worklog-drafts": { path: "/dashboard", tab: "worklog" },
	"/memory": { path: "/resources", tab: "memory" },
	"/resources/skills": { path: "/resources", tab: "skills" },
	"/resources/commands": { path: "/resources", tab: "commands" },
	"/resources/agents": { path: "/resources", tab: "agents" },
	"/resources/rules": { path: "/resources", tab: "rules" },
	"/mcp": { path: "/integrations", tab: "mcp" },
	"/hooks": { path: "/integrations", tab: "hooks" },
	"/repos": { path: "/integrations", tab: "repos" },
	"/techstacks": { path: "/integrations", tab: "techstacks" },
	"/tech-stacks": { path: "/integrations", tab: "techstacks" },
	"/config/permissions": { path: "/configuration", tab: "permissions" },
	"/config/hooks": { path: "/configuration", tab: "hooks" },
	"/config/ai": { path: "/configuration", tab: "ai" },
	"/config/ai-model": { path: "/configuration", tab: "ai" },
	"/config/plugins": { path: "/configuration", tab: "plugins" },
	"/config/preferences": { path: "/configuration", tab: "preferences" },
	"/config/chrome": { path: "/configuration", tab: "chrome" },
	"/actions/setup": { path: "/actions", tab: "setup" },
	"/actions/scan": { path: "/actions", tab: "scan" },
	"/actions/sync": { path: "/actions", tab: "sync" },
	"/actions/restore": { path: "/actions", tab: "restore" },
};

const redirectRoutes = Object.entries(REDIRECT_MAP).map(
	([from, { path, tab }]) => ({
		path: from,
		redirect: (to: RouteLocationGeneric) => ({
			path,
			query: { ...to.query, tab },
		}),
	}),
);

// ── 6 主路由（lazy import）────────────────────────────────────────────────────
const sectionRoutes = [
	{
		path: "dashboard",
		name: "dashboard",
		meta: { title: "Dashboard" },
		component: () => import("@/views/sections/DashboardSection.vue"),
	},
	{
		path: "resources",
		name: "resources",
		meta: { title: "Resources" },
		component: () => import("@/views/sections/ResourcesSection.vue"),
	},
	{
		path: "integrations",
		name: "integrations",
		meta: { title: "Integrations" },
		component: () => import("@/views/sections/IntegrationsSection.vue"),
	},
	{
		path: "configuration",
		name: "configuration",
		meta: { title: "Configuration" },
		component: () => import("@/views/sections/ConfigurationSection.vue"),
	},
	{
		path: "actions",
		name: "actions",
		meta: { title: "Actions" },
		component: () => import("@/views/sections/ActionsSection.vue"),
	},
	{
		path: "about",
		name: "about",
		meta: { title: "About" },
		component: () => import("@/views/sections/AboutSection.vue"),
	},
	{
		path: "ai-features",
		name: "ai-features",
		meta: { title: "AI Features" },
		component: () => import("@/views/sections/AiSection.vue"),
	},
	{
		path: "metrics",
		name: "metrics",
		meta: { title: "Metrics" },
		component: () => import("@/views/sections/MetricsSection.vue"),
	},
];

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/", redirect: "/dashboard" },
		{
			path: "/",
			component: () => import("@/layouts/ConsoleLayout.vue"),
			children: sectionRoutes,
		},
		...redirectRoutes,
		{ path: "/:pathMatch(.*)*", redirect: "/dashboard" },
	],
});

// ── ChunkLoadError 全局 retry（最多 3 次）────────────────────────────────────
const chunkRetryCount = new Map<string, number>();

router.onError((error, to) => {
	const isChunkError =
		error.message.includes("Failed to fetch dynamically imported module") ||
		error.message.includes("Importing a module script failed");
	if (!isChunkError) return;

	const key = String(to.fullPath);
	const attempts = (chunkRetryCount.get(key) ?? 0) + 1;
	chunkRetryCount.set(key, attempts);

	if (attempts <= 3) {
		void router.replace(to.fullPath);
	} else {
		chunkRetryCount.delete(key);
	}
});

export default router;
