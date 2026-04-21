<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useSettingsStore } from "@/stores/settings";

const store = useSettingsStore();
onMounted(() => store.fetchSettings());

const allow = ref<string[]>([]);
const deny = ref<string[]>([]);
const newAllow = ref("");
const newDeny = ref("");
const dirty = ref(false);

// 當 settings 載入時同步到本地編輯狀態
const initFromStore = () => {
	if (!store.settings?.permissions) return;
	allow.value = [...(store.settings.permissions.allow ?? [])];
	deny.value = [...(store.settings.permissions.deny ?? [])];
	dirty.value = false;
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const templateAllow = computed(() => {
	if (!store.settings?.permissions) return [];
	return (
		(store.settings.permissions as { templateAllow?: string[] })
			.templateAllow ?? []
	);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function addAllow() {
	const v = newAllow.value.trim();
	if (!v || allow.value.includes(v)) return;
	allow.value.push(v);
	newAllow.value = "";
	dirty.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function removeAllow(item: string) {
	allow.value = allow.value.filter((a) => a !== item);
	dirty.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function addDeny() {
	const v = newDeny.value.trim();
	if (!v || deny.value.includes(v)) return;
	deny.value.push(v);
	newDeny.value = "";
	dirty.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function removeDeny(item: string) {
	deny.value = deny.value.filter((d) => d !== item);
	dirty.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function save() {
	try {
		await store.patchPermissions(allow.value, deny.value);
		dirty.value = false;
		ElMessage.success("Permissions 已儲存");
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "儲存失敗");
	}
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function reset() {
	initFromStore();
}

// 監聽 settings 載入
import { watch } from "vue";

watch(() => store.settings, initFromStore, { immediate: true });
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <el-alert
      v-if="dirty"
      title="有未儲存的變更"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom:16px"
    >
      <template #default>
        <el-button size="small" type="primary" :loading="store.saving" @click="save">儲存</el-button>
        <el-button size="small" @click="reset" style="margin-left:8px">還原</el-button>
      </template>
    </el-alert>

    <el-row :gutter="16">
      <!-- Allow 清單 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>Allow（{{ allow.length }}）</span>
            <el-tag type="success" size="small" style="margin-left:8px">允許</el-tag>
          </template>
          <el-input
            v-model="newAllow"
            placeholder="新增 allow 規則，如 Bash(*)"
            size="small"
            style="margin-bottom:8px"
            clearable
            @keyup.enter="addAllow"
          >
            <template #append>
              <el-button size="small" @click="addAllow">新增</el-button>
            </template>
          </el-input>
          <div style="display:flex; flex-wrap:wrap; gap:6px">
            <el-tag
              v-for="item in allow"
              :key="item"
              type="success"
              closable
              size="small"
              @close="removeAllow(item)"
            >{{ item }}</el-tag>
          </div>
          <el-empty v-if="!allow.length" description="無 Allow 規則" :image-size="40" />
        </el-card>
      </el-col>

      <!-- Deny 清單 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>Deny（{{ deny.length }}）</span>
            <el-tag type="danger" size="small" style="margin-left:8px">拒絕</el-tag>
          </template>
          <el-input
            v-model="newDeny"
            placeholder="新增 deny 規則"
            size="small"
            style="margin-bottom:8px"
            clearable
            @keyup.enter="addDeny"
          >
            <template #append>
              <el-button size="small" @click="addDeny">新增</el-button>
            </template>
          </el-input>
          <div style="display:flex; flex-wrap:wrap; gap:6px">
            <el-tag
              v-for="item in deny"
              :key="item"
              type="danger"
              closable
              size="small"
              @close="removeDeny(item)"
            >{{ item }}</el-tag>
          </div>
          <el-empty v-if="!deny.length" description="無 Deny 規則" :image-size="40" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 權限分類分佈圖 -->
    <el-card v-if="allow.length > 0 || deny.length > 0" shadow="never" style="margin-top:16px; margin-bottom:16px">
      <template #header><span>權限分類分佈</span></template>
      <PermissionCategoryBar :allow="allow" :deny="deny" />
    </el-card>

    <!-- Template Allow（唯讀參考） -->
    <el-card shadow="never" style="margin-top:16px" v-if="templateAllow.length > 0">
      <template #header>
        <span>Template Allow（唯讀，來自 Claude 預設）</span>
      </template>
      <div style="display:flex; flex-wrap:wrap; gap:6px">
        <el-tag v-for="item in templateAllow" :key="item" type="info" size="small">{{ item }}</el-tag>
      </div>
    </el-card>

    <!-- 儲存按鈕 -->
    <div style="margin-top:16px; text-align:right">
      <el-button type="primary" :loading="store.saving" @click="save" :disabled="!dirty">
        儲存 Permissions
      </el-button>
    </div>
  </div>
</template>
