<script setup lang="ts">
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import { onMounted } from 'vue'

onMounted(() => {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDark)
    document.documentElement.classList.add('dark')
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches)
    })
})
</script>

<template>
  <el-config-provider :locale="zhTw">
    <RouterView />
  </el-config-provider>
</template>
