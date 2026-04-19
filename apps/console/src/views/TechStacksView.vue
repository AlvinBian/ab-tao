<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import TechStackSunburst from "@/charts/TechStackSunburst.vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const stacks = computed(() => store.data?.cachedTechStacks ?? {});
const timestamp = computed(() => store.data?.cachedTimestamp);
const searchQuery = ref("");

const categories = computed(() => {
	return Object.entries(stacks.value)
		.filter(([, techs]) => techs.length > 0)
		.sort(([, a], [, b]) => b.length - a.length);
});

const filteredCategories = computed(() => {
	const q = searchQuery.value.toLowerCase();
	if (!q) return categories.value;
	return categories.value
		.map(
			([cat, techs]) =>
				[cat, techs.filter((t) => t.toLowerCase().includes(q))] as [
					string,
					string[],
				],
		)
		.filter(([, techs]) => techs.length > 0);
});

const totalTechs = computed(() =>
	Object.values(stacks.value).reduce((sum, arr) => sum + arr.length, 0),
);

function formatTimestamp(ts: string | null | undefined): string {
	if (!ts) return "從未更新";
	return new Date(ts).toLocaleString("zh-TW");
}

const categoryColors: Record<string, string> = {
	frontend: "#409eff",
	backend: "#67c23a",
	mobile: "#e6a23c",
	devops: "#f56c6c",
	database: "#909399",
	testing: "#6f7ad3",
	tooling: "#17c0eb",
	language: "#1abc9c",
	framework: "#8e44ad",
	cloud: "#2980b9",
	ai: "#e74c3c",
	security: "#c0392b",
	uncategorized: "#bdc3c7",
};

function getCategoryColor(cat: string): string {
	return categoryColors[cat.toLowerCase()] ?? "#909399";
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 標頭 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row align="middle" justify="space-between">
        <el-col :span="14">
          <el-statistic title="技術總數" :value="totalTechs" style="display:inline-block; margin-right:24px" />
          <el-statistic title="分類數" :value="categories.length" style="display:inline-block" />
          <div style="margin-top:4px; font-size:12px; color:var(--el-text-color-secondary)">
            快取時間：{{ formatTimestamp(timestamp) }}
          </div>
        </el-col>
        <el-col :span="8">
          <el-input
            v-model="searchQuery"
            placeholder="搜尋技術名稱..."
            clearable
            size="small"
            prefix-icon="Search"
          />
        </el-col>
      </el-row>
    </el-card>

    <!-- Sunburst 圖 -->
    <el-card v-if="!searchQuery && categories.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header><span>技術棧分布（Sunburst）</span></template>
      <TechStackSunburst :stacks="stacks" />
    </el-card>

    <!-- 技術分類 -->
    <el-row :gutter="12" v-if="filteredCategories.length > 0">
      <el-col
        v-for="[category, techs] in filteredCategories"
        :key="category"
        :span="8"
        style="margin-bottom:12px"
      >
        <el-card shadow="hover">
          <template #header>
            <div style="display:flex; align-items:center; gap:8px">
              <span
                style="display:inline-block; width:10px; height:10px; border-radius:50%"
                :style="{ background: getCategoryColor(category) }"
              />
              <span style="font-weight:600; text-transform:capitalize">{{ category }}</span>
              <el-tag size="small" style="margin-left:auto">{{ techs.length }}</el-tag>
            </div>
          </template>
          <div style="display:flex; flex-wrap:wrap; gap:4px">
            <el-tag
              v-for="tech in techs"
              :key="tech"
              size="small"
              effect="plain"
            >{{ tech }}</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty
      v-if="!store.loading && filteredCategories.length === 0"
      :description="totalTechs === 0 ? '尚未執行 d:scan，無技術棧快取資料' : '無符合搜尋條件的技術'"
    />
  </div>
</template>
