<script setup lang="ts">
import type { SectionTabConfig } from '@/components/SectionTabs.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import AiModelView from '@/views/config/AiModelView.vue'
import ChromeView from '@/views/config/ChromeView.vue'
import HooksConfigView from '@/views/config/HooksConfigView.vue'
import PermissionsView from '@/views/config/PermissionsView.vue'
import PluginsView from '@/views/config/PluginsView.vue'
import PreferencesView from '@/views/config/PreferencesView.vue'

const tabs: SectionTabConfig[] = [
  { key: 'permissions', label: 'Permissions' },
  { key: 'hooks', label: 'Hooks' },
  { key: 'ai', label: 'AI Model' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'chrome', label: 'Chrome' },
]
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="permissions">
    <template #permissions>
      <PermissionsView />
    </template>
    <template #hooks>
      <HooksConfigView />
    </template>
    <template #ai>
      <AiModelView />
    </template>
    <template #plugins>
      <PluginsView />
    </template>
    <template #preferences>
      <PreferencesView />
    </template>
    <template #chrome>
      <ChromeView />
    </template>
  </SectionTabs>
</template>
