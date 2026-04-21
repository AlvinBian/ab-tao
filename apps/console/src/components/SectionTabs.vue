<script setup lang="ts">
import type { ComputedRef, Ref } from "vue";
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

// ── 型別定義 ─────────────────────────────────────────────────────────────────
export interface SectionTabConfig {
	key: string;
	label: string;
	badge?: ComputedRef<string | number> | Ref<string | number>;
}

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
	tabs: SectionTabConfig[];
	defaultTab?: string;
}>();

// ── URL ?tab= 雙向同步 ───────────────────────────────────────────────────────
const route = useRoute();
const router = useRouter();

const activeTab = ref<string>(
	(route.query.tab as string | undefined) ??
		props.defaultTab ??
		props.tabs[0]?.key ??
		"",
);

// URL 變化 → 本地狀態（瀏覽器前進 / 後退）
watch(
	() => route.query.tab,
	(val) => {
		const next = val as string | undefined;
		if (next && next !== activeTab.value) {
			activeTab.value = next;
		}
	},
);

// 使用者點擊 tab → 更新 URL（replace 不累積歷史堆疊）
function onTabChange(key: string): void {
	activeTab.value = key;
	void router.replace({ query: { ...route.query, tab: key } });
}
</script>

<template>
  <el-tabs
    v-model="activeTab"
    class="section-tabs"
    @tab-change="onTabChange"
  >
    <el-tab-pane
      v-for="tab in tabs"
      :key="tab.key"
      :name="tab.key"
    >
      <template #label>
        <span class="section-tab-label">
          {{ tab.label }}
          <el-badge
            v-if="tab.badge !== undefined"
            :value="tab.badge"
            class="section-tab-badge"
          />
        </span>
      </template>
      <slot :name="tab.key" />
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.section-tabs {
  width: 100%;
}

.section-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.section-tab-badge {
  vertical-align: middle;
}
</style>
