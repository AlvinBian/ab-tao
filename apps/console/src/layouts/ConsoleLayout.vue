<script setup lang="ts">
import {
	Connection,
	Expand,
	Files,
	Fold,
	InfoFilled,
	MagicStick,
	Monitor,
	Setting,
	VideoPlay,
} from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isCollapsed = ref(false);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const collapseIcon = computed(() => (isCollapsed.value ? Expand : Fold));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const navItems = [
	{ path: "/dashboard", label: "Dashboard", icon: Monitor },
	{ path: "/resources", label: "Resources", icon: Files },
	{ path: "/integrations", label: "Integrations", icon: Connection },
	{ path: "/configuration", label: "Configuration", icon: Setting },
	{ path: "/actions", label: "Actions", icon: VideoPlay },
	{ path: "/about", label: "About", icon: InfoFilled },
	{ path: "/ai-features", label: "AI Features", icon: MagicStick },
] as const;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeMenu = computed(() => route.path);
</script>

<template>
  <el-container class="console-layout" style="height: 100vh">
    <el-aside :width="isCollapsed ? '64px' : '200px'" style="transition: width 0.2s">
      <div class="sidebar-header">
        <span v-if="!isCollapsed" class="sidebar-title">ab-tao Console</span>
        <el-icon
          :size="18"
          style="cursor: pointer"
          @click="isCollapsed = !isCollapsed"
        >
          <component :is="collapseIcon" />
        </el-icon>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        router
        style="border-right: none; height: calc(100% - 50px); overflow-y: auto"
      >
        <el-menu-item
          v-for="item in navItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header
        style="
          padding: 0 16px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--el-border-color-light);
        "
      >
        <span style="flex: 1; font-weight: 600; font-size: 1rem">
          {{ route.meta.title ?? 'ab-tao Console' }}
        </span>
        <el-tag type="info" size="small">{{ appVersion }}</el-tag>
      </el-header>

      <el-main style="overflow-y: auto; padding: 0">
        <div class="console-content">
          <RouterView />
        </div>
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

.console-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px;
}
</style>
