import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { UnifiedReportData } from "@/types/status";

const TTL_MS = 30_000;

export const useStatusStore = defineStore("status", () => {
	const data = ref<UnifiedReportData | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const lastFetchedAt = ref(0);

	const isStale = computed(() => Date.now() - lastFetchedAt.value > TTL_MS);

	async function fetchData(force = false) {
		if (!force && !isStale.value && data.value) return;
		loading.value = true;
		error.value = null;
		try {
			const res = await fetch("/api/status/overview");
			const json = await res.json();
			if (json.code === 0) {
				data.value = json.data;
				lastFetchedAt.value = Date.now();
			} else {
				error.value = json.message;
			}
		} catch (e) {
			error.value = e instanceof Error ? e.message : "連線失敗";
		} finally {
			loading.value = false;
		}
	}

	/** 向後相容 alias */
	const overview = computed(() => data.value);

	return {
		data,
		overview,
		loading,
		error,
		isStale,
		fetchData,
		fetchOverview: fetchData,
	};
});
