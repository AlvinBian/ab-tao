<script setup lang="ts">
import { computed, onMounted } from "vue";
// biome-ignore lint/correctness/noUnusedImports: used in template
import { formatRelative } from "@/composables/useFormatRelative";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const d = computed(() => store.data);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const ccline = computed(() => d.value?.extended?.ccline);

const zshInstalled = computed(() => d.value?.zsh?.installed ?? []);
const zshAvailable = computed(() => d.value?.zsh?.available ?? []);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const zshMissing = computed(() =>
	zshAvailable.value.filter((m) => !zshInstalled.value.includes(m)),
);

const envHealth = computed(() => d.value?.envHealth);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasEnvIssues = computed(
	() =>
		(envHealth.value?.missing?.length ?? 0) +
			(envHealth.value?.empty?.length ?? 0) >
		0,
);

const zshCoveredCount = computed(
	() => zshAvailable.value.filter((m) => zshInstalled.value.includes(m)).length,
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const zshExtraCount = computed(() =>
	Math.max(0, zshInstalled.value.length - zshCoveredCount.value),
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const claudeMdFiles = computed(() => d.value?.claudeMd ?? []);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const pluginFiles = computed(() => d.value?.plugins ?? []);
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 環境健康總覽 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>環境健康總覽</span></template>
      <EnvHealthGauge
        :zsh-installed="zshInstalled"
        :zsh-available="zshAvailable"
        :ccline-installed="ccline?.installed ?? false"
        :ccline-status-line-configured="ccline?.statusLineConfigured ?? false"
        :env-missing-count="envHealth?.missing?.length ?? 0"
        :env-empty-count="envHealth?.empty?.length ?? 0"
      />
    </el-card>

    <el-row :gutter="16" style="margin-bottom:16px">
      <!-- ZSH 模組 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>ZSH 模組</span>
            <el-tag
              :type="zshMissing.length > 0 ? 'warning' : 'success'"
              size="small"
              style="margin-left:8px"
            >{{ zshCoveredCount }}/{{ zshAvailable.length }}<template v-if="zshExtraCount > 0"> +{{ zshExtraCount }} 額外</template></el-tag>
          </template>
          <div style="display:flex; flex-wrap:wrap; gap:6px">
            <el-tag
              v-for="m in zshAvailable"
              :key="m"
              :type="zshInstalled.includes(m) ? 'success' : 'danger'"
              size="small"
              effect="plain"
            >
              {{ m }}
              <el-icon v-if="!zshInstalled.includes(m)" style="margin-left:2px"><CircleClose /></el-icon>
            </el-tag>
          </div>
        </el-card>
      </el-col>

      <!-- AI 設定 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><span>AI 設定</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="主要模型">
              <el-tag size="small">{{ d?.ai?.model ?? "—" }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Effort">{{ d?.ai?.effort ?? "—" }}</el-descriptions-item>
            <el-descriptions-item label="Repo 模型">{{ d?.ai?.repoModel ?? "—" }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom:16px">
      <!-- CCLine 狀態 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><span>CCLine 狀態</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="已安裝">
              <el-tag :type="ccline?.installed ? 'success' : 'danger'" size="small">
                {{ ccline?.installed ? "是" : "否" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="StatusLine 設定">
              <el-tag :type="ccline?.statusLineConfigured ? 'success' : 'warning'" size="small">
                {{ ccline?.statusLineConfigured ? "已設定" : "未設定" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="指令">
              <code style="font-size:12px">{{ ccline?.command ?? "—" }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="Themes">
              <el-tag v-for="t in ccline?.themes ?? []" :key="t" size="small" style="margin:2px">{{ t }}</el-tag>
              <span v-if="!ccline?.themes?.length" style="color:var(--el-text-color-placeholder)">無</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <!-- 環境變數健康 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>環境變數健康</span>
            <el-tag :type="hasEnvIssues ? 'danger' : 'success'" size="small" style="margin-left:8px">
              {{ hasEnvIssues ? "有問題" : "正常" }}
            </el-tag>
          </template>
          <template v-if="hasEnvIssues">
            <div v-if="envHealth?.missing?.length" style="margin-bottom:8px">
              <div style="font-size:12px; color:var(--el-color-danger); margin-bottom:4px">缺失</div>
              <el-tag v-for="k in envHealth.missing" :key="k" type="danger" size="small" style="margin:2px">{{ k }}</el-tag>
            </div>
            <div v-if="envHealth?.empty?.length">
              <div style="font-size:12px; color:var(--el-color-warning); margin-bottom:4px">空值</div>
              <el-tag v-for="k in envHealth.empty" :key="k" type="warning" size="small" style="margin:2px">{{ k }}</el-tag>
            </div>
          </template>
          <el-empty v-else description="環境變數設定正常" :image-size="50" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom:16px">
      <!-- Permissions -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><span>Permissions</span></template>
          <div style="margin-bottom:8px">
            <div style="font-size:12px; color:var(--el-color-success); margin-bottom:4px">Allow（{{ d?.permissions?.allow?.length ?? 0 }}）</div>
            <el-tag v-for="p in d?.permissions?.allow ?? []" :key="p" type="success" size="small" style="margin:2px">{{ p }}</el-tag>
            <span v-if="!d?.permissions?.allow?.length" style="color:var(--el-text-color-placeholder); font-size:12px">無</span>
          </div>
          <div>
            <div style="font-size:12px; color:var(--el-color-danger); margin-bottom:4px">Deny（{{ d?.permissions?.deny?.length ?? 0 }}）</div>
            <el-tag v-for="p in d?.permissions?.deny ?? []" :key="p" type="danger" size="small" style="margin:2px">{{ p }}</el-tag>
            <span v-if="!d?.permissions?.deny?.length" style="color:var(--el-text-color-placeholder); font-size:12px">無</span>
          </div>
        </el-card>
      </el-col>

      <!-- Backups -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><span>備份記錄（{{ d?.backups?.length ?? 0 }}）</span></template>
          <el-table :data="(d?.backups ?? []).slice(0, 5)" size="small">
            <el-table-column label="備份目錄">
              <template #default="{ row }">
                <code style="font-size:11px">{{ row }}</code>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!d?.backups?.length" description="無備份記錄" :image-size="40" />
        </el-card>
      </el-col>
    </el-row>

    <!-- CLAUDE.md 檔案 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header><span>CLAUDE.md 檔案（{{ claudeMdFiles.length }}）</span></template>
      <el-table :data="claudeMdFiles" size="small" max-height="200">
        <el-table-column prop="path" label="路徑" min-width="200" show-overflow-tooltip />
        <el-table-column label="修改時間" width="160">
          <template #default="{ row }">{{ formatRelative(row.mtime) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Plugins 檔案 -->
    <el-card shadow="never">
      <template #header><span>Plugin 檔案（{{ pluginFiles.length }}）</span></template>
      <el-table :data="pluginFiles" size="small" max-height="200">
        <el-table-column prop="name" label="名稱" min-width="200" show-overflow-tooltip />
        <el-table-column label="修改時間" width="160">
          <template #default="{ row }">{{ formatRelative(row.mtime) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
