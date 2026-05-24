<script setup lang="ts">
import { onMounted, ref } from 'vue'

// ── 型別定義 ──────────────────────────────────────────────────────────────

interface McpServer {
  name: string
  type: string
  url: string | null
  command: string | null
  args: string[] | null
  source: 'global' | 'project'
  projectPath: string | null
}

interface McpPlugin {
  name: string
  marketplace: string
  enabled: boolean
}

interface MarketplacePlugin {
  name: string
  [key: string]: unknown
}

interface Marketplace {
  id: string
  plugins: MarketplacePlugin[]
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// ── Servers tab ───────────────────────────────────────────────────────────

const servers = ref<McpServer[]>([])
const serversLoading = ref(false)
const serversError = ref('')

async function fetchServers(): Promise<void> {
  serversLoading.value = true
  serversError.value = ''
  try {
    const res = await fetch('/api/mcp/servers')
    const body: ApiResponse<McpServer[]> = await res.json()
    if (body.code === 0) {
      servers.value = body.data ?? []
    }
    else {
      serversError.value = body.message
    }
  }
  catch (e) {
    serversError.value = e instanceof Error ? e.message : '取得 Servers 失敗'
  }
  finally {
    serversLoading.value = false
  }
}

// ── Plugins tab ───────────────────────────────────────────────────────────

const plugins = ref<McpPlugin[]>([])
const pluginsLoading = ref(false)
const pluginsError = ref('')

async function fetchPlugins(): Promise<void> {
  pluginsLoading.value = true
  pluginsError.value = ''
  try {
    const res = await fetch('/api/mcp/plugins')
    const body: ApiResponse<McpPlugin[]> = await res.json()
    if (body.code === 0) {
      plugins.value = body.data ?? []
    }
    else {
      pluginsError.value = body.message
    }
  }
  catch (e) {
    pluginsError.value = e instanceof Error ? e.message : '取得 Plugins 失敗'
  }
  finally {
    pluginsLoading.value = false
  }
}

// ── Marketplace tab ───────────────────────────────────────────────────────

const marketplaces = ref<Marketplace[]>([])
const marketplaceLoading = ref(false)
const marketplaceError = ref('')

async function fetchMarketplace(): Promise<void> {
  marketplaceLoading.value = true
  marketplaceError.value = ''
  try {
    const res = await fetch('/api/mcp/marketplace')
    const body: ApiResponse<Marketplace[]> = await res.json()
    if (body.code === 0) {
      marketplaces.value = body.data ?? []
    }
    else {
      marketplaceError.value = body.message
    }
  }
  catch (e) {
    marketplaceError.value
      = e instanceof Error ? e.message : '取得 Marketplace 失敗'
  }
  finally {
    marketplaceLoading.value = false
  }
}

// ── 顯示 URL 或 Command 欄位 ──────────────────────────────────────────────

function serverEndpoint(row: McpServer): string {
  if (row.url)
    return row.url
  if (row.command) {
    const parts = [row.command, ...(row.args ?? [])]
    return parts.join(' ')
  }
  return '—'
}

// ── 掛載時同時發起三個請求 ────────────────────────────────────────────────

onMounted(() => {
  fetchServers()
  fetchPlugins()
  fetchMarketplace()
})
</script>

<template>
  <el-tabs type="border-card">
    <!-- ────────────────── Servers ────────────────── -->
    <el-tab-pane label="Servers">
      <el-skeleton v-if="serversLoading" :rows="4" animated />

      <el-alert
        v-else-if="serversError"
        :title="serversError"
        type="error"
        show-icon
        style="margin-bottom: 12px"
      />

      <template v-else>
        <el-table
          v-if="servers.length > 0"
          :data="servers"
          stripe
          size="small"
          style="width: 100%"
        >
          <el-table-column prop="name" label="名稱" min-width="160" />
          <el-table-column prop="type" label="類型" width="90" align="center">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.type === 'sse' ? 'warning' : row.type === 'http' ? 'info' : 'primary'"
              >
                {{ row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="來源" width="100" align="center">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.source === 'global' ? 'success' : undefined"
              >
                {{ row.source === "global" ? "全域" : "專案" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="URL / Command"
            min-width="240"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <code style="font-size: 11px; color: var(--el-text-color-secondary)">
                {{ serverEndpoint(row) }}
              </code>
            </template>
          </el-table-column>
          <el-table-column
            prop="projectPath"
            label="專案路徑"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span style="font-size: 11px; color: var(--el-text-color-placeholder)">
                {{ row.projectPath ?? "—" }}
              </span>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="未設定 MCP Server" />
      </template>
    </el-tab-pane>

    <!-- ────────────────── Plugins ────────────────── -->
    <el-tab-pane label="Plugins">
      <el-skeleton v-if="pluginsLoading" :rows="4" animated />

      <el-alert
        v-else-if="pluginsError"
        :title="pluginsError"
        type="error"
        show-icon
        style="margin-bottom: 12px"
      />

      <template v-else>
        <el-table
          v-if="plugins.length > 0"
          :data="plugins"
          stripe
          size="small"
          style="width: 100%"
        >
          <el-table-column prop="name" label="名稱" min-width="180" />
          <el-table-column
            prop="marketplace"
            label="Marketplace"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column label="狀態" width="100" align="center">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.enabled ? 'success' : 'danger'"
              >
                {{ row.enabled ? "已啟用" : "已停用" }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="無啟用 Plugin" />
      </template>
    </el-tab-pane>

    <!-- ────────────────── Marketplace ────────────────── -->
    <el-tab-pane label="Marketplace">
      <el-skeleton v-if="marketplaceLoading" :rows="4" animated />

      <el-alert
        v-else-if="marketplaceError"
        :title="marketplaceError"
        type="error"
        show-icon
        style="margin-bottom: 12px"
      />

      <template v-else-if="marketplaces.length === 0">
        <el-empty description="本地 Marketplace 快取為空（~/.claude/plugins/marketplaces/ 不存在）" />
      </template>

      <template v-else>
        <!-- 逐個 Marketplace 顯示 -->
        <el-card
          v-for="mp in marketplaces"
          :key="mp.id"
          shadow="never"
          style="margin-bottom: 12px"
        >
          <template #header>
            <span style="font-weight: 600">{{ mp.id }}</span>
            <el-tag size="small" style="margin-left: 8px" type="info">
              {{ mp.plugins.length }} 個插件
            </el-tag>
          </template>

          <el-table
            v-if="mp.plugins.length > 0"
            :data="mp.plugins"
            stripe
            size="small"
            style="width: 100%"
          >
            <el-table-column prop="name" label="插件名稱" min-width="200" />
          </el-table>

          <el-empty
            v-else
            description="本地快取中無插件資訊"
            :image-size="40"
          />
        </el-card>
      </template>
    </el-tab-pane>
  </el-tabs>
</template>
