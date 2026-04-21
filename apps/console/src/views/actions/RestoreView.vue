<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";

interface BackupItem {
	id: string;
	fileCount: number;
	size: string;
	contents: string[];
}

const backups = ref<BackupItem[]>([]);
const loading = ref(false);
const restoring = ref<string | null>(null);

async function fetchBackups() {
	loading.value = true;
	try {
		const r = await fetch("/api/restore/backups");
		const { code, message, data } = await r.json();
		if (code !== 0) {
			ElMessage.error(message ?? "無法載入備份列表");
			return;
		}
		backups.value = Array.isArray(data) ? data : [];
	} catch {
		ElMessage.error("無法載入備份列表");
	} finally {
		loading.value = false;
	}
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function restore(backupId: string) {
	restoring.value = backupId;
	try {
		const r = await fetch("/api/restore/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ backupId }),
		});
		const { code, message } = await r.json();
		if (code === 0) ElMessage.success(message);
		else ElMessage.error(message);
	} catch {
		ElMessage.error("還原失敗");
	} finally {
		restoring.value = null;
	}
}

onMounted(fetchBackups);
</script>

<template>
  <div>
    <!-- 備份趨勢圖 -->
    <el-card v-if="backups.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header><span>備份歷史（最近 12 筆）</span></template>
      <BackupSizeBar
        :backups="backups.map(b => ({ id: b.id, fileCount: b.fileCount }))"
      />
    </el-card>

    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>備份列表</span>
        <el-button size="small" style="margin-left:8px" @click="fetchBackups">重新整理</el-button>
      </template>

      <el-table v-loading="loading" :data="backups" size="small" style="width:100%">
        <el-table-column prop="id" label="備份 ID" show-overflow-tooltip />
        <el-table-column prop="fileCount" label="檔案數" width="80" align="center" />
        <el-table-column prop="size" label="大小" width="90" align="right" />
        <el-table-column label="內容" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="c in row.contents"
              :key="c"
              size="small"
              style="margin-right:4px; margin-bottom:2px"
            >
              {{ c }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center">
          <template #default="{ row }">
            <el-popconfirm
              :title="`確認還原備份 ${row.id}？`"
              confirm-button-text="確認還原"
              cancel-button-text="取消"
              confirm-button-type="danger"
              @confirm="restore(row.id)"
            >
              <template #reference>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :loading="restoring === row.id"
                >
                  還原
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && backups.length === 0"
        description="尚無備份，執行 Resources/Config 變更後會自動建立備份"
        :image-size="60"
      />
    </el-card>

    <el-alert
      title="注意：還原會覆蓋當前 ~/.claude/ 及 ZSH 配置，建議在確認目標備份正確後再執行。"
      type="warning"
      show-icon
      :closable="false"
    />
  </div>
</template>
