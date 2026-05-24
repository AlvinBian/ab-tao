<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

interface LogEntry {
  level: string
  message: string
}

const props = withDefaults(
  defineProps<{
    logs: LogEntry[]
    height?: string
    autoScroll?: boolean
  }>(),
  { height: '260px', autoScroll: true },
)

const scrollRef = ref<HTMLElement>()

watch(
  () => props.logs.length,
  () => {
    if (!props.autoScroll)
      return
    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = scrollRef.value.scrollHeight
      }
    })
  },
)
</script>

<template>
  <div
    ref="scrollRef"
    class="log-tail"
    :style="{ height: props.height }"
  >
    <div v-if="!logs.length" class="log-empty">
      （無輸出）
    </div>
    <div
      v-for="(entry, i) in logs"
      :key="i"
      class="log-line"
      :class="`log-${entry.level}`"
    >
      <span class="log-prefix">{{ entry.level === 'warn' ? '⚠' : entry.level === 'error' ? '✗' : '›' }}</span>
      <span class="log-msg">{{ entry.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.log-tail {
  overflow-y: auto;
  background: var(--el-fill-color-darker, #1a1a2e);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
.log-empty {
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 20px 0;
}
.log-line {
  display: flex;
  gap: 6px;
  word-break: break-all;
}
.log-prefix {
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  width: 14px;
  text-align: center;
}
.log-warn .log-prefix { color: var(--el-color-warning); }
.log-error .log-prefix { color: var(--el-color-danger); }
.log-warn .log-msg { color: var(--el-color-warning); }
.log-error .log-msg { color: var(--el-color-danger); }
</style>
