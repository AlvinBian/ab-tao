<script setup lang="ts">
import { onMounted } from "vue";
import ResourceListView from "@/components/ResourceListView.vue";
import { useSkillsStore } from "@/stores/resources";

const store = useSkillsStore();
onMounted(() => store.fetchItems());
</script>

<template>
  <ResourceListView
    :store="store"
    kind-label="Skill"
    :show-source-column="true"
    :show-path-column="true"
  />
</template>
