import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { UnifiedReportData } from "@/types/status";

export interface ModelUsage {
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	requests: number;
}

export interface DayUsage {
	day: string;
	models: Record<string, Omit<ModelUsage, "model">>;
}

export interface AiUsageData {
	byDay: DayUsage[];
	byModel: ModelUsage[];
	allModels: string[];
	meta: {
		source: "absent" | "empty" | "ok";
		range: string;
		fileCount: number;
		totalRequests: number;
	};
}

const TTL_MS = 30_000;

export const useStatusStore = defineStore("status", () => {
	const data = ref<UnifiedReportData | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const lastFetchedAt = ref(0);

	const aiUsage = ref<AiUsageData | null>(null);
	const aiUsageLoading = ref(false);
	const aiUsageError = ref<string | null>(null);

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

	async function loadAiUsage(range: "7d" | "30d" | "all" = "7d") {
		aiUsageLoading.value = true;
		aiUsageError.value = null;
		try {
			const res = await fetch(`/api/status/ai-usage?range=${range}`);
			const json = await res.json();
			if (json.code === 0) {
				aiUsage.value = json.data;
			} else {
				aiUsageError.value = json.message;
			}
		} catch (e) {
			aiUsageError.value = e instanceof Error ? e.message : "連線失敗";
		} finally {
			aiUsageLoading.value = false;
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
		aiUsage,
		aiUsageLoading,
		aiUsageError,
		loadAiUsage,
	};
});
