<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, ref, watch } from 'vue'
import SettingRow from '@/components/SettingRow.vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()
onMounted(() => store.fetchPrefs())

const form = ref<Record<string, unknown>>({})
const dirty = ref(false)

watch(
  () => store.prefs,
  (p) => {
    if (!p)
      return
    form.value = { ...p.prefs }
    dirty.value = false
  },
  { immediate: true },
)

function onChange() {
  dirty.value = true
}

async function save() {
  try {
    await store.savePrefs(form.value)
    dirty.value = false
    ElMessage.success('Preferences 已部署')
  }
  catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '儲存失敗')
  }
}

function reset() {
  if (!store.prefs)
    return
  form.value = { ...store.prefs.prefs }
  dirty.value = false
}

function getDefault(key: string): unknown {
  return store.prefs?.defaults?.[key]
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

    <el-card shadow="never">
      <template #header>
        <span>Preferences 設定</span>
      </template>

      <el-form v-if="store.prefs" label-width="180px" label-position="left">
        <SettingRow label="Notify Flush (秒)">
          <el-input-number
            v-model="(form as Record<string, number>).notifyFlushSecs"
            :min="1"
            :max="3600"
            @change="onChange"
          />
          <template #description>
            預設：{{ getDefault('notifyFlushSecs') }}
          </template>
        </SettingRow>

        <SettingRow
          label="Keybinding"
          description="ZSH readline 鍵位綁定；emacs 為大多數終端預設，vi 適合習慣 vim 的使用者。"
        >
          <el-radio-group v-model="(form as Record<string, string>).keybinding" @change="onChange">
            <el-radio value="emacs">
              emacs
            </el-radio>
            <el-radio value="vi">
              vi
            </el-radio>
          </el-radio-group>
        </SettingRow>

        <SettingRow
          label="CLI Editor"
          description="終端文字編輯器，用於 git commit message 及互動式操作。"
        >
          <el-select v-model="(form as Record<string, string>).cliEditor" placeholder="選擇編輯器" @change="onChange">
            <el-option label="vim" value="vim" />
            <el-option label="nvim" value="nvim" />
            <el-option label="nano" value="nano" />
            <el-option label="emacs" value="emacs" />
          </el-select>
        </SettingRow>

        <SettingRow
          label="Bat Theme"
          description="bat 語法高亮主題，影響 cat 替代指令的色彩呈現。"
        >
          <el-select v-model="(form as Record<string, string>).batTheme" placeholder="選擇主題" clearable @change="onChange">
            <el-option label="Dracula" value="Dracula" />
            <el-option label="TwoDark" value="TwoDark" />
            <el-option label="OneHalfDark" value="OneHalfDark" />
            <el-option label="GitHub" value="GitHub" />
          </el-select>
        </SettingRow>

        <SettingRow label="UV Override Pip" description="使用 uv 取代 pip，提升 Python 套件安裝速度。">
          <el-switch v-model="(form as Record<string, boolean>).uvOverridePip" @change="onChange" />
        </SettingRow>

        <SettingRow
          label="Sync 99-local"
          description="啟用後將 ~/.claude/settings.local.json 同步至 iCloud；內含個人 token 與本機路徑等敏感資訊，僅在受信任的個人環境啟用。"
        >
          <el-switch v-model="(form as Record<string, boolean>).sync99Local" @change="onChange" />
        </SettingRow>
      </el-form>

      <div style="text-align:right; margin-top:16px; display:flex; gap:8px; justify-content:flex-end">
        <el-button :disabled="!dirty" @click="reset">
          還原
        </el-button>
        <el-button type="primary" :loading="store.saving" :disabled="!dirty" @click="save">
          儲存並部署
        </el-button>
      </div>
    </el-card>
  </div>
</template>
