<script setup lang="ts">
import LogTail from "./LogTail.vue";

interface LogEntry {
	level: string;
	message: string;
}

defineProps<{
	running: boolean;
	done: boolean;
	success: boolean | null;
	progress: number;
	stage?: string;
	logs: LogEntry[];
	errorMsg?: string;
	logHeight?: string;
}>();
</script>

<template>
  <div>
    <!-- 進度條 -->
    <div style="margin-bottom:12px">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px">
        <span style="font-size:13px; color:var(--el-text-color-secondary)">
          {{ stage || (running ? '執行中…' : done ? (success ? '完成' : '失敗') : '等待執行') }}
        </span>
        <el-tag v-if="done" :type="success ? 'success' : 'danger'" size="small">
          {{ success ? '成功' : '失敗' }}
        </el-tag>
        <el-tag v-else-if="running" type="primary" size="small">執行中</el-tag>
      </div>
      <el-progress
        :percentage="done ? 100 : running ? Math.max(progress, 5) : 0"
        :status="done ? (success ? 'success' : 'exception') : undefined"
        :striped="running"
        :striped-flow="running"
        :duration="3"
      />
    </div>

    <!-- 錯誤訊息 -->
    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom:10px"
    />

    <!-- Log tail -->
    <LogTail :logs="logs" :height="logHeight ?? '240px'" />
  </div>
</template>
