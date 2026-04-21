<script setup lang="ts">
import { onMounted } from "vue";
import ResourceListView from "@/components/ResourceListView.vue";
import { useAgentsStore } from "@/stores/resources";

const store = useAgentsStore();
onMounted(() => store.fetchItems());
</script>

<template>
  <ResourceListView :store="store" kind-label="Agent" />
</template>
