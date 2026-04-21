<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const mem = computed(() => store.data?.extended?.memory);
const global = computed(() => mem.value?.global);
const projects = computed(() => mem.value?.projects ?? []);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasMemoryData = computed(
	() => !!global.value || projects.value.length > 0,
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function decodeProjectName(encoded: string): string {
	try {
		return decodeURIComponent(encoded.replace(/-/g, "/"));
	} catch {
		return encoded;
	}
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- Memory 分佈圖 -->
    <el-card v-if="hasMemoryData" shadow="never" style="margin-bottom:16px">
      <template #header><span>Memory 分佈（Global + 各專案）</span></template>
      <MemoryStackedBar :global="global" :projects="projects" />
    </el-card>

    <!-- 各專案檔案數排行 -->
    <el-card v-if="projects.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header><span>專案 Memory 檔案數排行（Top 10）</span></template>
      <MemorySizeBar
        :projects="projects.map(p => ({ label: decodeProjectName(p.encoded), count: p.memory.length + p.plans.length + p.tasks.length }))"
        :top-n="10"
      />
    </el-card>

    <!-- 全域 Memory -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>全域 Memory</span></template>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-card shadow="never">
            <template #header>
              <span style="font-size:13px">Memory 檔案（{{ global?.memory?.length ?? 0 }}）</span>
            </template>
            <el-tag
              v-for="f in global?.memory ?? []"
              :key="f"
              size="small"
              style="margin:2px"
              type="primary"
            >{{ f }}</el-tag>
            <el-empty v-if="!global?.memory?.length" description="無" :image-size="40" />
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never">
            <template #header>
              <span style="font-size:13px">Plans（{{ global?.plans?.length ?? 0 }}）</span>
            </template>
            <el-tag
              v-for="f in global?.plans ?? []"
              :key="f"
              size="small"
              style="margin:2px"
              type="success"
            >{{ f }}</el-tag>
            <el-empty v-if="!global?.plans?.length" description="無" :image-size="40" />
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never">
            <template #header>
              <span style="font-size:13px">Tasks（{{ global?.tasks?.length ?? 0 }}）</span>
            </template>
            <el-tag
              v-for="f in global?.tasks ?? []"
              :key="f"
              size="small"
              style="margin:2px"
              type="warning"
            >{{ f }}</el-tag>
            <el-empty v-if="!global?.tasks?.length" description="無" :image-size="40" />
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- 專案 Memory -->
    <el-card shadow="never">
      <template #header><span>專案 Memory（{{ projects.length }} 個專案）</span></template>
      <el-collapse accordion>
        <el-collapse-item
          v-for="proj in projects"
          :key="proj.encoded"
          :name="proj.encoded"
        >
          <template #title>
            <span style="font-size:13px">{{ decodeProjectName(proj.encoded) }}</span>
            <el-tag size="small" style="margin-left:8px">{{ proj.memory.length + proj.plans.length + proj.tasks.length }} 個檔案</el-tag>
          </template>
          <el-row :gutter="12">
            <el-col :span="8">
              <div style="font-size:12px; color:var(--el-text-color-secondary); margin-bottom:4px">Memory</div>
              <el-tag v-for="f in proj.memory" :key="f" size="small" style="margin:2px" type="primary">{{ f }}</el-tag>
              <span v-if="!proj.memory.length" style="color:var(--el-text-color-placeholder); font-size:12px">無</span>
            </el-col>
            <el-col :span="8">
              <div style="font-size:12px; color:var(--el-text-color-secondary); margin-bottom:4px">Plans</div>
              <el-tag v-for="f in proj.plans" :key="f" size="small" style="margin:2px" type="success">{{ f }}</el-tag>
              <span v-if="!proj.plans.length" style="color:var(--el-text-color-placeholder); font-size:12px">無</span>
            </el-col>
            <el-col :span="8">
              <div style="font-size:12px; color:var(--el-text-color-secondary); margin-bottom:4px">Tasks</div>
              <el-tag v-for="f in proj.tasks" :key="f" size="small" style="margin:2px" type="warning">{{ f }}</el-tag>
              <span v-if="!proj.tasks.length" style="color:var(--el-text-color-placeholder); font-size:12px">無</span>
            </el-col>
          </el-row>
        </el-collapse-item>
      </el-collapse>
      <el-empty v-if="!projects.length && !store.loading" description="無專案 Memory 資料" />
    </el-card>
  </div>
</template>
