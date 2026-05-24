<script setup lang="ts">
import type { SectionTabConfig } from '@/components/SectionTabs.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import McpView from '@/views/McpView.vue'
import ReposView from '@/views/ReposView.vue'
import TechStacksView from '@/views/TechStacksView.vue'

const tabs: SectionTabConfig[] = [
  { key: 'mcp', label: 'MCP Servers' },
  { key: 'repos', label: 'Repos' },
  { key: 'techstacks', label: 'Tech Stacks' },
]
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="mcp">
    <template #mcp>
      <McpView />
    </template>
    <template #repos>
      <ReposView />
    </template>
    <template #techstacks>
      <TechStacksView />
    </template>
  </SectionTabs>
</template>
