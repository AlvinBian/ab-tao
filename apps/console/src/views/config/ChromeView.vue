<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

interface ChromeStatus {
  installed: boolean
  localStateExists: boolean
  experiments: string[]
}

interface ZshStatus {
  deployed: boolean
  path: string
  confDir: string
}

const loading = ref(false)
const applying = ref(false)
const status = ref<ChromeStatus | null>(null)
const zshStatus = ref<ZshStatus | null>(null)
const error = ref('')

async function fetchStatus() {
  loading.value = true
  error.value = ''
  try {
    const [chromeRes, zshRes] = await Promise.all([
      fetch('/api/chrome/status'),
      fetch('/api/chrome/zsh-status'),
    ])
    const chromeJson = await chromeRes.json()
    const zshJson = await zshRes.json()
    if (chromeJson.code === 0)
      status.value = chromeJson.data
    if (zshJson.code === 0)
      zshStatus.value = zshJson.data
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '載入失敗'
  }
  finally {
    loading.value = false
  }
}

async function applyFlags() {
  applying.value = true
  try {
    const res = await fetch('/api/chrome/apply-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json()
    if (json.code === 0) {
      ElMessage.success(json.message)
      await fetchStatus()
    }
    else {
      ElMessage.error(json.message ?? '套用失敗')
    }
  }
  catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '套用失敗')
  }
  finally {
    applying.value = false
  }
}

onMounted(fetchStatus)
</script>

<template>
  <div v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" show-icon style="margin-bottom:16px" />

    <el-card shadow="never">
      <el-tabs type="border-card">
        <!-- ── Tab: Flags ── -->
        <el-tab-pane label="Flags">
          <el-descriptions
            v-if="status"
            :column="2"
            border
            size="small"
            style="margin-bottom:16px"
          >
            <el-descriptions-item label="Chrome 已安裝">
              <el-tag :type="status.installed ? 'success' : 'danger'" size="small">
                {{ status.installed ? "是" : "否" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Local State 存在">
              <el-tag :type="status.localStateExists ? 'success' : 'warning'" size="small">
                {{ status.localStateExists ? "是" : "否" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="已套用 Experiments 數量" :span="2">
              {{ status.experiments.length }}
            </el-descriptions-item>
          </el-descriptions>

          <template v-if="status && status.experiments.length > 0">
            <p style="font-size:13px; color:var(--el-text-color-secondary); margin-bottom:8px">
              已套用的 experiments：
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px">
              <el-tag
                v-for="exp in status.experiments"
                :key="exp"
                size="small"
                type="info"
              >
                {{ exp }}
              </el-tag>
            </div>
          </template>

          <el-empty
            v-else-if="status && status.experiments.length === 0"
            description="尚未套用任何 flags"
            :image-size="60"
            style="margin-bottom:12px"
          />

          <el-button
            type="primary"
            :loading="applying"
            :disabled="!status?.installed"
            @click="applyFlags"
          >
            套用 Flags
          </el-button>
          <el-button @click="fetchStatus">
            重新整理
          </el-button>
        </el-tab-pane>

        <!-- ── Tab: ZSH 工具 ── -->
        <el-tab-pane label="ZSH 工具">
          <el-descriptions
            v-if="zshStatus"
            :column="1"
            border
            size="small"
            style="margin-bottom:16px"
          >
            <el-descriptions-item label="35-chrome.zsh 部署狀態">
              <el-tag :type="zshStatus.deployed ? 'success' : 'warning'" size="small">
                {{ zshStatus.deployed ? "已部署" : "未部署" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="目標路徑">
              <code style="font-size:12px">{{ zshStatus.path }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="ZSH 設定目錄">
              <code style="font-size:12px">{{ zshStatus.confDir }}</code>
            </el-descriptions-item>
          </el-descriptions>

          <el-empty
            v-if="zshStatus && !zshStatus.deployed"
            description="35-chrome.zsh 尚未部署，請執行 pnpm run d:setup"
            :image-size="60"
            style="margin-bottom:12px"
          />

          <el-button @click="fetchStatus">
            重新整理
          </el-button>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
