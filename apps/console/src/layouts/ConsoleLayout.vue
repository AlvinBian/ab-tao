<script setup lang="ts">
import {
	CircleCheck,
	Connection,
	Cpu,
	DataAnalysis,
	Document,
	Expand,
	Files,
	Fold,
	Menu,
	Monitor,
	Odometer,
	Operation,
	Setting,
	Tools,
} from "@element-plus/icons-vue";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isCollapsed = ref(false);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const collapseIcon = computed(() => (isCollapsed.value ? Expand : Fold));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const menuItems = [
	{
		key: "view",
		label: "檢視",
		icon: Monitor,
		children: [
			{ path: "/overview", label: "Overview", icon: Monitor },
			{ path: "/state", label: "State & Drift", icon: Document },
			{ path: "/memory", label: "Memory & Plans", icon: Files },
			{ path: "/mcp", label: "MCP 伺服器", icon: Connection },
			{ path: "/hooks", label: "Hooks 健檢狀態", icon: CircleCheck },
			{ path: "/repos", label: "Repos", icon: DataAnalysis },
			{ path: "/techstacks", label: "技術棧", icon: Menu },
			{ path: "/environment", label: "環境資訊", icon: Cpu },
		],
	},
	{
		key: "resources",
		label: "資源管理",
		icon: Files,
		children: [
			{ path: "/resources/skills", label: "Skills", icon: Menu },
			{ path: "/resources/commands", label: "Commands", icon: Document },
			{ path: "/resources/agents", label: "Agents", icon: Connection },
			{ path: "/resources/rules", label: "Rules", icon: Files },
		],
	},
	{
		key: "config",
		label: "配置中心",
		icon: Setting,
		children: [
			{ path: "/config/permissions", label: "Permissions", icon: Setting },
			{ path: "/config/ai", label: "AI 模型", icon: DataAnalysis },
			{ path: "/config/hooks", label: "Hooks 啟用設定", icon: Odometer },
			{ path: "/config/plugins", label: "Claude 擴充套件", icon: Tools },
			{ path: "/config/preferences", label: "偏好設定", icon: Setting },
			{ path: "/config/chrome", label: "Chrome 優化", icon: Monitor },
		],
	},
	{
		key: "actions",
		label: "執行動作",
		icon: Tools,
		children: [
			{ path: "/actions/setup", label: "Setup 精靈", icon: Tools },
			{ path: "/actions/scan", label: "技術棧掃描", icon: Operation },
			{ path: "/actions/sync", label: "Sync 同步", icon: Connection },
			{ path: "/actions/restore", label: "還原備份", icon: Files },
		],
	},
];

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeMenu = computed(() => route.path);

// 路徑 → group key
function groupKeyForPath(path: string): string {
	if (path.startsWith("/resources")) return "resources";
	if (path.startsWith("/config")) return "config";
	if (path.startsWith("/actions")) return "actions";
	return "view";
}

// localStorage 持久化展開狀態
const STORAGE_KEY = "ab-tao-console-opened-menu";

function loadSavedMenus(): string[] {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (Array.isArray(parsed)) return parsed;
		}
	} catch {
		// ignore
	}
	return [groupKeyForPath(route.path)];
}

const openedMenus = ref<string[]>(loadSavedMenus());

function saveMenus(keys: string[]) {
	openedMenus.value = keys;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
	} catch {
		// ignore
	}
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleMenuOpen(key: string) {
	saveMenus([key]);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleMenuClose(key: string) {
	saveMenus(openedMenus.value.filter((k) => k !== key));
}

// 路由切換時自動展開對應 group
watch(
	() => route.path,
	(path) => {
		const key = groupKeyForPath(path);
		if (!openedMenus.value.includes(key)) {
			saveMenus([key]);
		}
	},
);
</script>

<template>
  <el-container class="console-layout" style="height: 100vh">
    <el-aside :width="isCollapsed ? '64px' : '220px'" style="transition: width 0.2s">
      <div class="sidebar-header">
        <span v-if="!isCollapsed" class="sidebar-title">ab-tao Console</span>
        <el-icon
          :size="18"
          style="cursor:pointer"
          @click="isCollapsed = !isCollapsed"
        >
          <component :is="collapseIcon" />
        </el-icon>
      </div>
      <el-menu
        :default-active="activeMenu"
        :default-openeds="openedMenus"
        :collapse="isCollapsed"
        unique-opened
        router
        style="border-right: none; height: calc(100% - 50px); overflow-y: auto"
        @open="handleMenuOpen"
        @close="handleMenuClose"
      >
        <el-sub-menu
          v-for="group in menuItems"
          :key="group.key"
          :index="group.key"
        >
          <template #title>
            <el-icon><component :is="group.icon" /></el-icon>
            <span>{{ group.label }}</span>
          </template>
          <el-menu-item
            v-for="item in group.children"
            :key="item.path"
            :index="item.path"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="padding: 0 16px; display:flex; align-items:center; border-bottom: 1px solid var(--el-border-color-light)">
        <span style="flex:1; font-weight: 600; font-size: 1rem">
          {{ route.meta.title ?? 'ab-tao Console' }}
        </span>
        <el-tag type="info" size="small">{{ appVersion }}</el-tag>
      </el-header>

      <el-main style="overflow-y: auto; padding: 20px">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.console-layout {
  background-color: var(--el-bg-color-page);
}

.sidebar-header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--el-text-color-primary);
}

.sidebar-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
