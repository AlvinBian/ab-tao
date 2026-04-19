<script setup lang="ts">
import {
	Connection,
	Cpu,
	DataAnalysis,
	Document,
	Files,
	Link,
	Menu,
	Monitor,
	Operation,
	Setting,
	Tools,
} from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isCollapsed = ref(false);

const menuItems = [
	{
		label: "儀表板",
		children: [
			{ path: "/overview", label: "Overview", icon: Monitor },
			{ path: "/environment", label: "環境資訊", icon: Cpu },
		],
	},
	{
		label: "資源管理",
		children: [
			{ path: "/resources/skills", label: "Skills", icon: Menu },
			{ path: "/resources/commands", label: "Commands", icon: Document },
			{ path: "/resources/agents", label: "Agents", icon: Connection },
			{ path: "/resources/rules", label: "Rules", icon: Files },
		],
	},
	{
		label: "配置中心",
		children: [
			{ path: "/hooks", label: "Hooks 健檢", icon: Link },
			{ path: "/config/permissions", label: "Permissions", icon: Setting },
			{ path: "/config/ai", label: "AI 模型", icon: DataAnalysis },
			{ path: "/config/hooks", label: "Hook 開關", icon: Link },
			{ path: "/config/plugins", label: "Plugins", icon: Tools },
			{ path: "/config/preferences", label: "偏好設定", icon: Setting },
		],
	},
	{
		label: "資料檢視",
		children: [
			{ path: "/state", label: "State & Drift", icon: Document },
			{ path: "/memory", label: "Memory & Plans", icon: Files },
			{ path: "/mcp", label: "MCP & Plugins", icon: Connection },
			{ path: "/repos", label: "Repos", icon: DataAnalysis },
			{ path: "/techstacks", label: "技術棧", icon: Menu },
		],
	},
	{
		label: "執行動作",
		children: [
			{ path: "/actions/setup", label: "Setup 精靈", icon: Tools },
			{ path: "/actions/scan", label: "技術棧掃描", icon: Operation },
			{ path: "/actions/sync", label: "Sync 同步", icon: Connection },
		],
	},
];

const activeMenu = computed(() => route.path);
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
          <component :is="isCollapsed ? 'Expand' : 'Fold'" />
        </el-icon>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        router
        style="border-right: none; height: calc(100% - 50px); overflow-y: auto"
      >
        <template v-for="group in menuItems" :key="group.label">
          <el-menu-item-group v-if="!isCollapsed" :title="group.label">
            <el-menu-item
              v-for="item in group.children"
              :key="item.path"
              :index="item.path"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </el-menu-item>
          </el-menu-item-group>
          <template v-else>
            <el-menu-item
              v-for="item in group.children"
              :key="item.path"
              :index="item.path"
            >
              <el-tooltip :content="item.label" placement="right">
                <el-icon><component :is="item.icon" /></el-icon>
              </el-tooltip>
            </el-menu-item>
          </template>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="padding: 0 16px; display:flex; align-items:center; border-bottom: 1px solid var(--el-border-color-light)">
        <span style="flex:1; font-weight: 600; font-size: 1rem">
          {{ route.meta.title ?? 'ab-tao Console' }}
        </span>
        <el-tag type="info" size="small">v0.1.0</el-tag>
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
