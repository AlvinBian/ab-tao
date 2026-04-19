import { defineStore } from "pinia";
import { ref } from "vue";
import type { ExtendedData } from "@/types/extended";

const TTL_MS = 30_000;

export const useExtendedStore = defineStore("extended", () => {
	const data = ref<ExtendedData | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const lastFetchedAt = ref(0);

	async function fetch(force = false) {
		if (!force && data.value && Date.now() - lastFetchedAt.value < TTL_MS)
			return;
		loading.value = true;
		error.value = null;
		try {
			const res = await globalThis.fetch("/api/status/extended");
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

	return { data, loading, error, fetch };
});
