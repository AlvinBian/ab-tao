<script setup lang="ts">
import { computed } from "vue";

interface McpServer {
	name: string;
	type: string;
	status?: "connected" | "disconnected" | "unknown";
	lastSeen?: string;
}

const props = defineProps<{
	data: McpServer[] | null;
	loading?: boolean;
	error?: string | null;
	height?: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const heightPx = computed(() => `${props.height ?? 320}px`);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isEmpty(d: unknown): boolean {
	return (
		d == null ||
		(Array.isArray(d) && d.length === 0) ||
		(typeof d === "object" &&
			!Array.isArray(d) &&
			Object.keys(d as object).length === 0)
	);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const STATUS_COLOR: Record<string, string> = {
	connected: "var(--el-color-success)",
	disconnected: "var(--el-color-danger)",
	unknown: "var(--el-color-info)",
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const STATUS_TYPE: Record<
	string,
	"success" | "danger" | "info" | "primary" | "warning"
> = {
	connected: "success",
	disconnected: "danger",
	unknown: "info",
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
function statusLabel(s?: string): string {
	const map: Record<string, string> = {
		connected: "已連線",
		disconnected: "已斷線",
		unknown: "未知",
	};
	return map[s ?? "unknown"] ?? "未知";
}
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="isEmpty(data)" description="暫無資料" :image-size="40" />
  <div v-else :style="{ height: heightPx, overflowY: 'auto' }">
    <el-timeline>
      <el-timeline-item
        v-for="server in data"
        :key="server.name"
        :color="STATUS_COLOR[server.status ?? 'unknown']"
        :timestamp="server.lastSeen ?? ''"
        placement="top"
      >
        <el-card shadow="never" style="padding: 0">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            <span style="font-weight: 600; font-size: 13px">{{ server.name }}</span>
            <el-tag size="small" effect="plain">{{ server.type }}</el-tag>
            <el-tag
              size="small"
              :type="STATUS_TYPE[server.status ?? 'unknown']"
            >
              {{ statusLabel(server.status) }}
            </el-tag>
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>
