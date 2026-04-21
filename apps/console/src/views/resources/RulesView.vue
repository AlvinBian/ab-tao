<script setup lang="ts">
import { onMounted } from "vue";
import ResourceListView from "@/components/ResourceListView.vue";
import { useRulesStore } from "@/stores/resources";

const store = useRulesStore();
onMounted(() => store.fetchItems());
</script>

<template>
  <ResourceListView :store="store" kind-label="Rule" />
</template>
