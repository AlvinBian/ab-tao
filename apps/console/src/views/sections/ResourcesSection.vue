<script setup lang="ts">
import type { SectionTabConfig } from '@/components/SectionTabs.vue'
import { onMounted } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import { useStatusStore } from '@/stores/status'
import MemoryView from '@/views/MemoryView.vue'
import AgentsView from '@/views/resources/AgentsView.vue'
import CommandsView from '@/views/resources/CommandsView.vue'
import RulesView from '@/views/resources/RulesView.vue'
import SkillsView from '@/views/resources/SkillsView.vue'

const statusStore = useStatusStore()
onMounted(() => statusStore.fetchData())

const tabs: SectionTabConfig[] = [
  { key: 'memory', label: 'Memory & Plans' },
  { key: 'skills', label: 'Skills' },
  { key: 'commands', label: 'Commands' },
  { key: 'agents', label: 'Agents' },
  { key: 'rules', label: 'Rules' },
]
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="memory">
    <template #memory>
      <MemoryView />
    </template>
    <template #skills>
      <SkillsView />
    </template>
    <template #commands>
      <CommandsView />
    </template>
    <template #agents>
      <AgentsView />
    </template>
    <template #rules>
      <RulesView />
    </template>
  </SectionTabs>
</template>
