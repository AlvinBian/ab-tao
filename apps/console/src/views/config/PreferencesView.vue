<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref, watch } from "vue";
import { useSettingsStore } from "@/stores/settings";

const store = useSettingsStore();
onMounted(() => store.fetchPrefs());

const form = ref<Record<string, unknown>>({});
const dirty = ref(false);

watch(
	() => store.prefs,
	(p) => {
		if (!p) return;
		form.value = { ...p.prefs };
		dirty.value = false;
	},
	{ immediate: true },
);

function onChange() {
	dirty.value = true;
}

async function save() {
	try {
		await store.savePrefs(form.value);
		dirty.value = false;
		ElMessage.success("Preferences 已部署");
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "儲存失敗");
	}
}

function reset() {
	if (!store.prefs) return;
	form.value = { ...store.prefs.prefs };
	dirty.value = false;
}

function getDefault(key: string): unknown {
	return store.prefs?.defaults?.[key];
}
</script>

<template>
  <div v-loading="!store.prefs && store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <el-alert
      v-if="dirty"
      title="有未儲存的變更（儲存後自動部署到 ~/.zshrc.d/.prefs.zsh 與 ~/.claude/hooks/.prefs）"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom:16px"
    />

    <el-card shadow="never" style="max-width:700px">
      <template #header><span>Preferences 設定</span></template>

      <el-form v-if="store.prefs" label-width="180px" label-position="left">
        <!-- notifyFlushSecs -->
        <el-form-item label="Notify Flush (秒)">
          <el-input-number
            v-model="(form as Record<string, number>).notifyFlushSecs"
            :min="1"
            :max="3600"
            @change="onChange"
          />
          <span style="margin-left:8px; color:var(--el-text-color-secondary); font-size:12px">
            預設：{{ getDefault('notifyFlushSecs') }}
          </span>
        </el-form-item>

        <!-- keybinding -->
        <el-form-item label="Keybinding">
          <el-radio-group v-model="(form as Record<string, string>).keybinding" @change="onChange">
            <el-radio value="emacs">emacs</el-radio>
            <el-radio value="vi">vi</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- cliEditor -->
        <el-form-item label="CLI Editor">
          <el-select v-model="(form as Record<string, string>).cliEditor" placeholder="選擇編輯器" @change="onChange">
            <el-option label="vim" value="vim" />
            <el-option label="nvim" value="nvim" />
            <el-option label="nano" value="nano" />
            <el-option label="emacs" value="emacs" />
          </el-select>
        </el-form-item>

        <!-- batTheme -->
        <el-form-item label="Bat Theme">
          <el-select v-model="(form as Record<string, string>).batTheme" placeholder="選擇主題" @change="onChange" clearable>
            <el-option label="Dracula" value="Dracula" />
            <el-option label="TwoDark" value="TwoDark" />
            <el-option label="OneHalfDark" value="OneHalfDark" />
            <el-option label="GitHub" value="GitHub" />
          </el-select>
        </el-form-item>

        <!-- uvOverridePip -->
        <el-form-item label="UV Override Pip">
          <el-switch v-model="(form as Record<string, boolean>).uvOverridePip" @change="onChange" />
          <span style="margin-left:8px; font-size:12px; color:var(--el-text-color-secondary)">使用 uv 取代 pip</span>
        </el-form-item>

        <!-- sync99Local -->
        <el-form-item label="Sync 99-local">
          <el-switch v-model="(form as Record<string, boolean>).sync99Local" @change="onChange" />
          <span style="margin-left:8px; font-size:12px; color:var(--el-text-color-secondary)">同步 99-local 設定</span>
        </el-form-item>
      </el-form>

      <div style="text-align:right; margin-top:16px; display:flex; gap:8px; justify-content:flex-end">
        <el-button @click="reset" :disabled="!dirty">還原</el-button>
        <el-button type="primary" :loading="store.saving" @click="save" :disabled="!dirty">
          儲存並部署
        </el-button>
      </div>
    </el-card>
  </div>
</template>
