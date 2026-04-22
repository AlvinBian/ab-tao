<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import type { AddHookPayload, HookEntry } from "@/stores/settings";
import { useSettingsStore } from "@/stores/settings";

const store = useSettingsStore();
onMounted(() => store.fetchSettings());

interface HookRow {
	event: string;
	idx: number;
	id: string;
	description: string;
	command: string;
	matcher?: string;
	timeout?: number;
	enabled: boolean;
}

interface AbTaoSettings {
	disabledHooks?: Record<string, HookEntry[]>;
}

const groupedHooks = computed(() => {
	const result = new Map<string, HookRow[]>();
	const hooks = store.settings?.hooks ?? {};
	const abTao = (store.settings as { _abTao?: AbTaoSettings } | null)?._abTao;
	const disabledHooks = abTao?.disabledHooks ?? {};

	const allEvents = new Set([
		...Object.keys(hooks),
		...Object.keys(disabledHooks),
	]);

	for (const event of allEvents) {
		const rows: HookRow[] = [];

		for (const [idx, entry] of (hooks[event] ?? []).entries()) {
			for (const h of entry.hooks ?? []) {
				rows.push({
					event,
					idx,
					id: entry.id,
					description: entry.description,
					command: h.command ?? "",
					matcher: entry.matcher,
					timeout: h.timeout,
					enabled: true,
				});
			}
		}

		for (const entry of disabledHooks[event] ?? []) {
			for (const h of entry.hooks ?? []) {
				rows.push({
					event,
					idx: -1,
					id: entry.id,
					description: entry.description,
					command: h.command ?? "",
					matcher: entry.matcher,
					timeout: h.timeout,
					enabled: false,
				});
			}
		}

		result.set(event, rows);
	}

	return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const events = computed(() => [...groupedHooks.value.keys()]);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const totalEnabled = computed(
	() => [...groupedHooks.value.values()].flat().filter((r) => r.enabled).length,
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const totalHooks = computed(() =>
	[...groupedHooks.value.values()].reduce((n, rows) => n + rows.length, 0),
);

// ── Toggle ──
const togglingKey = ref<string | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function toggleHook(row: HookRow, enabled: boolean) {
	const key = `${row.event}:${row.idx}:${row.id}`;
	togglingKey.value = key;
	try {
		if (!enabled) {
			await store.patchHook(row.event, row.idx, { enabled: false });
			ElMessage.success(`已停用 ${row.id}`);
		} else {
			await store.patchHook(row.event, 0, { enabled: true });
			ElMessage.success(`已啟用 ${row.id}`);
		}
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "切換失敗");
	} finally {
		togglingKey.value = null;
	}
}

// ── Delete ──
// biome-ignore lint/correctness/noUnusedVariables: used in template
async function deleteHook(row: HookRow) {
	if (row.idx < 0) {
		ElMessage.warning("已停用的 Hook 請先啟用後再刪除");
		return;
	}
	try {
		await ElMessageBox.confirm(
			`確定要永久刪除 Hook「${row.id}」？此操作不可復原。`,
			"刪除確認",
			{
				type: "warning",
				confirmButtonText: "刪除",
				cancelButtonText: "取消",
				confirmButtonClass: "el-button--danger",
			},
		);
		await store.deleteHook(row.event, row.idx);
		ElMessage.success(`已刪除 ${row.id}`);
	} catch (e) {
		if (e !== "cancel") {
			ElMessage.error(e instanceof Error ? e.message : "刪除失敗");
		}
	}
}

// ── Add Hook Dialog ──
const addDialogVisible = ref(false);
const addEventTarget = ref("");
const addForm = reactive({ command: "", matcher: "" });

// biome-ignore lint/correctness/noUnusedVariables: used in template
function openAddDialog(event: string) {
	addEventTarget.value = event;
	addForm.command = "";
	addForm.matcher = "";
	addDialogVisible.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function confirmAdd() {
	if (!addForm.command.trim()) {
		ElMessage.warning("請填寫 Command");
		return;
	}
	const payload: AddHookPayload = {
		command: addForm.command.trim(),
		matcher: addForm.matcher.trim() || undefined,
	};
	try {
		await store.addHook(addEventTarget.value, payload);
		ElMessage.success("Hook 已新增");
		addDialogVisible.value = false;
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "新增失敗");
	}
}

// ── Redeploy ──
const redeploying = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function redeployAll() {
	redeploying.value = true;
	try {
		const res = await fetch("/api/hooks/redeploy", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ hookId: "all" }),
		});
		const json = (await res.json()) as {
			code: number;
			message?: string;
			data?: { results?: unknown[] };
		};
		if (json.code === 0) {
			ElMessage.success(
				`重新部署完成（${json.data?.results?.length ?? 0} 個腳本）`,
			);
		} else {
			throw new Error(json.message);
		}
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "重新部署失敗");
	} finally {
		redeploying.value = false;
	}
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />
    <el-alert
      v-if="store.isReadonly"
      :title="store.readonlyMessage ?? 'd:setup 執行中，設定暫時唯讀'"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom:16px"
    />

    <!-- 頂部操作列 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row align="middle" justify="space-between">
        <el-col :span="14" style="display:flex; align-items:center; gap:24px">
          <el-statistic title="啟用 Hook" :value="totalEnabled" />
          <el-statistic title="總計" :value="totalHooks" />
          <el-statistic title="事件類型" :value="events.length" />
        </el-col>
        <el-col :span="8" style="text-align:right">
          <el-button
            type="primary"
            :loading="redeploying"
            @click="redeployAll"
          >
            重新部署所有 Hook 腳本
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 按事件分組 -->
    <el-card
      v-for="event in events"
      :key="event"
      shadow="never"
      style="margin-bottom:12px"
    >
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between">
          <div style="display:flex; align-items:center; gap:8px">
            <span style="font-weight:600">{{ event }}</span>
            <el-tag size="small" type="info">
              {{ (groupedHooks.get(event) ?? []).filter(h => h.enabled).length }} 個啟用
            </el-tag>
          </div>
          <el-button
            size="small"
            type="primary"
            plain
            @click="openAddDialog(event)"
          >
            + 新增 Hook
          </el-button>
        </div>
      </template>

      <el-table
        :data="groupedHooks.get(event) ?? []"
        size="small"
        style="width:100%"
        :row-class-name="(({ row }: { row: HookRow }) => row.enabled ? '' : 'hook-row--disabled')"
      >
        <el-table-column label="啟用" width="70" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="togglingKey === `${row.event}:${row.idx}:${row.id}`"
              :disabled="store.isReadonly"
              @change="(v: string | number | boolean) => toggleHook(row as HookRow, v as boolean)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="id" label="ID" width="180" show-overflow-tooltip />
        <el-table-column prop="description" label="說明" min-width="160" show-overflow-tooltip />
        <el-table-column prop="matcher" label="Matcher" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.matcher" size="small" effect="plain">{{ row.matcher }}</el-tag>
            <span v-else style="color:var(--el-text-color-placeholder)">—</span>
          </template>
        </el-table-column>
        <el-table-column label="指令" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:11px; color:var(--el-text-color-secondary)">{{ row.command }}</code>
          </template>
        </el-table-column>
        <el-table-column label="Timeout" width="90" align="center">
          <template #default="{ row }">
            <span v-if="row.timeout">{{ row.timeout }}s</span>
            <span v-else style="color:var(--el-text-color-placeholder)">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center">
          <template #default="{ row }">
            <el-button
              size="small"
              type="danger"
              text
              :disabled="row.idx < 0 || store.isReadonly"
              @click="deleteHook(row as HookRow)"
            >
              刪除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-empty v-if="!store.loading && totalHooks === 0" description="settings.json 中無 Hook 設定" />

    <!-- 新增 Hook Dialog -->
    <el-dialog
      v-model="addDialogVisible"
      :title="`新增 Hook — ${addEventTarget}`"
      width="520px"
      destroy-on-close
    >
      <el-form label-width="100px" label-position="left">
        <el-form-item label="Command" required>
          <el-input
            v-model="addForm.command"
            placeholder="例：$HOME/.claude/hooks/custom.sh"
            clearable
          />
        </el-form-item>
        <el-form-item label="Matcher">
          <el-input
            v-model="addForm.matcher"
            placeholder="例：Bash（選填，不填則匹配所有工具）"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAdd">新增</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:deep(.hook-row--disabled) {
  opacity: 0.5;
}
</style>
