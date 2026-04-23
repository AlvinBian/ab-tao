<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { WorklogDraft } from "@/stores/worklog";
import { useWorklogStore } from "@/stores/worklog";

const store = useWorklogStore();

const selected = ref<string[]>([]);
const editDialogVisible = ref(false);
const editTarget = ref<WorklogDraft | null>(null);
const editForm = ref({
	ticketKey: "",
	durationH: 0,
	durationM: 0,
	comment: "",
});

const totalHours = computed(() =>
	store.drafts.reduce((sum, d) => sum + d.durationSec / 3600, 0),
);
const unknownCount = computed(
	() => store.drafts.filter((d) => d.ticketKey === "unknown").length,
);
const todayCount = computed(() => {
	const today = new Date().toISOString().slice(0, 10);
	return store.drafts.filter((d) => d.createdAt.startsWith(today)).length;
});

function fmtDuration(sec: number) {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	return `${h}h${m.toString().padStart(2, "0")}m`;
}

function fmtDate(iso: string) {
	return iso ? iso.slice(0, 16).replace("T", " ") : "";
}

function openEdit(row: WorklogDraft) {
	editTarget.value = { ...row };
	const h = Math.floor(row.durationSec / 3600);
	const m = Math.floor((row.durationSec % 3600) / 60);
	editForm.value = {
		ticketKey: row.ticketKey,
		durationH: h,
		durationM: m,
		comment: row.comment,
	};
	editDialogVisible.value = true;
}

async function confirmEdit() {
	if (!editTarget.value) return;
	const durationSec =
		editForm.value.durationH * 3600 + editForm.value.durationM * 60;
	await store.patch(editTarget.value.id, {
		ticketKey: editForm.value.ticketKey,
		durationSec,
		comment: editForm.value.comment,
	});
	editDialogVisible.value = false;
}

async function dismissOne(id: string) {
	await store.dismiss([id]);
	selected.value = selected.value.filter((s) => s !== id);
}

async function dismissSelected() {
	if (selected.value.length === 0) return;
	await store.dismiss(selected.value);
	selected.value = [];
}

function handleSelectionChange(rows: WorklogDraft[]) {
	selected.value = rows.map((r) => r.id);
}

onMounted(() => store.load());
</script>

<template>
  <div class="worklog-drafts">
    <!-- 統計卡 -->
    <div class="stat-cards" v-if="store.drafts.length > 0 || store.loading">
      <div class="stat-card">
        <div class="label">Drafts</div>
        <div class="value">{{ store.drafts.length }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Hours</div>
        <div class="value">{{ totalHours.toFixed(1) }}h</div>
      </div>
      <div class="stat-card">
        <div class="label">Unknown Ticket</div>
        <div class="value" :class="{ warn: unknownCount > 0 }">{{ unknownCount }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Today</div>
        <div class="value">{{ todayCount }}</div>
      </div>
    </div>

    <!-- 工具列 -->
    <div class="toolbar">
      <el-button size="small" :loading="store.loading" @click="store.load()">刷新</el-button>
      <el-button
        size="small"
        type="warning"
        :disabled="selected.length === 0"
        @click="dismissSelected"
      >
        批次略過（{{ selected.length }}）
      </el-button>
      <div class="hint">批次提交請至 Claude Code 執行 <code>/worklog</code></div>
    </div>

    <!-- 錯誤 -->
    <el-alert v-if="store.error" type="error" :title="store.error" show-icon style="margin-bottom:12px" />

    <!-- 草稿列表 -->
    <el-table
      v-if="store.drafts.length > 0"
      :data="store.drafts"
      size="small"
      :border="false"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="44" />
      <el-table-column prop="ticketKey" label="Ticket" width="110">
        <template #default="{ row }">
          <span :class="{ 'ticket-unknown': row.ticketKey === 'unknown' }">
            {{ row.ticketKey }}
            <span v-if="row.ticketKey === 'unknown'" class="warn-icon">⚠️</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="Duration" width="90" align="right">
        <template #default="{ row }">{{ fmtDuration(row.durationSec) }}</template>
      </el-table-column>
      <el-table-column prop="branch" label="Branch" min-width="180">
        <template #default="{ row }">
          <span class="branch-name">{{ row.branch || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="Commits" width="76" align="right">
        <template #default="{ row }">{{ row.commits?.length ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="Started" width="130">
        <template #default="{ row }">{{ fmtDate(row.startedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" align="center">
        <template #default="{ row }">
          <el-button link size="small" @click="openEdit(row)">修改</el-button>
          <el-button link size="small" type="danger" @click="dismissOne(row.id)">略過</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty
      v-else-if="!store.loading"
      description="無待處理 worklog 草稿"
      :image-size="60"
    />

    <!-- 編輯 Dialog -->
    <el-dialog v-model="editDialogVisible" title="修改 Worklog 草稿" width="480px">
      <el-form v-if="editTarget" label-width="90px" size="small">
        <el-form-item label="Ticket Key">
          <el-input v-model="editForm.ticketKey" placeholder="如 VM-1531" />
        </el-form-item>
        <el-form-item label="工時">
          <div class="duration-row">
            <el-input-number v-model="editForm.durationH" :min="0" :max="23" label="小時" />
            <span class="duration-sep">h</span>
            <el-input-number v-model="editForm.durationM" :min="0" :max="59" label="分鐘" />
            <span class="duration-sep">m</span>
          </div>
        </el-form-item>
        <el-form-item label="Comment">
          <el-input
            v-model="editForm.comment"
            type="textarea"
            :rows="4"
            placeholder="工作摘要（可多行）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEdit">確認</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.worklog-drafts {
  padding: 4px 0;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
}

.stat-card .label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.stat-card .value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-card .value.warn {
  color: var(--el-color-warning);
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: auto;
}

.hint code {
  background: var(--el-fill-color);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.branch-name {
  font-size: 12px;
  font-family: monospace;
  color: var(--el-text-color-regular);
}

.ticket-unknown {
  color: var(--el-color-warning);
}

.warn-icon {
  margin-left: 2px;
}

.duration-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.duration-sep {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
