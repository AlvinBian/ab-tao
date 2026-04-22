<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: used in template
import { InfoFilled } from "@element-plus/icons-vue";

defineProps<{
	label: string;
	description?: string;
	hint?: string;
	labelWidth?: string;
	required?: boolean;
	disabled?: boolean;
	error?: string;
}>();
</script>

<template>
  <el-form-item
    :label="label"
    :label-width="labelWidth"
    :required="required"
    :error="error"
  >
    <div class="setting-row__body">
      <div :class="['setting-row__control', { 'setting-row__control--disabled': disabled }]">
        <slot />
        <slot name="extra" />
      </div>
      <div v-if="description || $slots.description || hint" class="setting-row__desc">
        <slot name="description">{{ description }}</slot>
        <el-tooltip v-if="hint" :content="hint" placement="top">
          <el-icon class="setting-row__hint-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
    </div>
  </el-form-item>
</template>

<style scoped>
.setting-row__body {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  column-gap: 16px;
  align-items: center;
  width: 100%;
}

.setting-row__desc {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 4px;
}

.setting-row__control--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.setting-row__hint-icon {
  cursor: help;
  font-size: 14px;
}
</style>
