<script setup lang="ts">
import { onMounted } from "vue";
import ResourceListView from "@/components/ResourceListView.vue";
import { useCommandsStore } from "@/stores/resources";

const store = useCommandsStore();
onMounted(() => store.fetchItems());
</script>

<template>
  <ResourceListView :store="store" kind-label="Command" />
</template>
