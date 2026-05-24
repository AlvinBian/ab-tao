<script setup lang="ts">
import type { SectionTabConfig } from '@/components/SectionTabs.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import EnvironmentView from '@/views/EnvironmentView.vue'
import OverviewView from '@/views/OverviewView.vue'
import StateView from '@/views/StateView.vue'
import TokenStatsView from '@/views/TokenStatsView.vue'
import WorklogDraftsView from '@/views/WorklogDraftsView.vue'

const tabs: SectionTabConfig[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'state', label: 'State & Drift' },
  { key: 'environment', label: 'Environment' },
  { key: 'stats', label: 'Token Stats' },
  { key: 'worklog', label: 'Worklog Drafts' },
]
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="overview">
    <template #overview>
      <OverviewView />
    </template>
    <template #state>
      <StateView />
    </template>
    <template #environment>
      <EnvironmentView />
    </template>
    <template #stats>
      <TokenStatsView />
    </template>
    <template #worklog>
      <WorklogDraftsView />
    </template>
  </SectionTabs>
</template>
