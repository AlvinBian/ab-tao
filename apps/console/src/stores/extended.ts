/**
 * extended store — 已合併至 useStatusStore
 * 保留向後相容 shim，實際資料從 useStatusStore().data.extended 取得
 */
import { defineStore } from "pinia";
import { computed } from "vue";
import { useStatusStore } from "./status";

export const useExtendedStore = defineStore("extended", () => {
	const status = useStatusStore();

	const data = computed(() => status.data?.extended ?? null);
	const loading = computed(() => status.loading);
	const error = computed(() => status.error);

	async function fetch(force = false) {
		await status.fetchData(force);
	}

	return { data, loading, error, fetch };
});
