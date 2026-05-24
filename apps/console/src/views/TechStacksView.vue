<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCategoryColor } from '@/charts/categoryColors'
import { formatRelative } from '@/composables/useFormatRelative'
import { useStatusStore } from '@/stores/status'

const store = useStatusStore()
onMounted(() => store.fetchData())

const stacks = computed(() => store.data?.cachedTechStacks ?? {})
const timestamp = computed(() => store.data?.cachedTimestamp)
const searchQuery = ref('')
const chartMode = ref<'sunburst' | 'pie' | 'bar' | 'treemap'>('sunburst')

const categories = computed(() => {
  return Object.entries(stacks.value)
    .filter(([, techs]) => techs.length > 0)
    .sort(([, a], [, b]) => b.length - a.length)
})

const filteredCategories = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q)
    return categories.value
  return categories.value
    .map(
      ([cat, techs]) =>
        [cat, techs.filter(t => t.toLowerCase().includes(q))] as [
          string,
          string[],
        ],
    )
    .filter(([, techs]) => techs.length > 0)
})

const totalTechs = computed(() =>
  Object.values(stacks.value).reduce((sum, arr) => sum + arr.length, 0),
)
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
            快取時間：{{ formatRelative(timestamp) }}
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

    <!-- 圖表（搜尋時隱藏） -->
    <el-card v-if="!searchQuery && categories.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header>
        <div style="display:flex; align-items:center; gap:12px">
          <span>技術棧分布</span>
          <el-radio-group v-model="chartMode" size="small">
            <el-radio-button value="sunburst">
              Sunburst
            </el-radio-button>
            <el-radio-button value="pie">
              Pie
            </el-radio-button>
            <el-radio-button value="bar">
              Bar
            </el-radio-button>
            <el-radio-button value="treemap">
              Treemap
            </el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <TechStackSunburst v-if="chartMode === 'sunburst'" :stacks="stacks" />
      <TechStackPie v-else-if="chartMode === 'pie'" :stacks="stacks" />
      <TechStackBar v-else-if="chartMode === 'bar'" :stacks="stacks" />
      <TechStackTreemap v-else :stacks="stacks" />
    </el-card>

    <!-- 技術分類 -->
    <el-row v-if="filteredCategories.length > 0" :gutter="12">
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
              <el-tag size="small" style="margin-left:auto">
                {{ techs.length }}
              </el-tag>
            </div>
          </template>
          <div style="display:flex; flex-wrap:wrap; gap:4px">
            <el-tag
              v-for="tech in techs"
              :key="tech"
              size="small"
              effect="plain"
            >
              {{ tech }}
            </el-tag>
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
