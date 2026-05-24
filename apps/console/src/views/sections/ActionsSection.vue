<script setup lang="ts">
import type { SectionTabConfig } from '@/components/SectionTabs.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import RestoreView from '@/views/actions/RestoreView.vue'
import ScanView from '@/views/actions/ScanView.vue'
import SetupWizardView from '@/views/actions/SetupWizardView.vue'
import SyncView from '@/views/actions/SyncView.vue'

const tabs: SectionTabConfig[] = [
  { key: 'setup', label: 'Setup 精靈' },
  { key: 'scan', label: '技術棧掃描' },
  { key: 'sync', label: 'Sync 同步' },
  { key: 'restore', label: '還原備份' },
]
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="setup">
    <template #setup>
      <SetupWizardView />
    </template>
    <template #scan>
      <ScanView />
    </template>
    <template #sync>
      <SyncView />
    </template>
    <template #restore>
      <RestoreView />
    </template>
  </SectionTabs>
</template>
