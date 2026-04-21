<script setup lang="ts">
import type { SectionTabConfig } from "@/components/SectionTabs.vue";
import SectionTabs from "@/components/SectionTabs.vue";
import EnvironmentView from "@/views/EnvironmentView.vue";
import OverviewView from "@/views/OverviewView.vue";
import StateView from "@/views/StateView.vue";

const tabs: SectionTabConfig[] = [
	{ key: "overview", label: "Overview" },
	{ key: "state", label: "State & Drift" },
	{ key: "environment", label: "Environment" },
];
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
  </SectionTabs>
</template>
