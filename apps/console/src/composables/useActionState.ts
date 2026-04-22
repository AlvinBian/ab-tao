import { computed, ref } from "vue";

export type ActionState =
	| "idle"
	| "running"
	| "success"
	| "failed"
	| "retrying"
	| "retry-failed";

export function useActionState(maxRetries = 3) {
	const state = ref<ActionState>("idle");
	const retryCount = ref(0);
	const traceId = ref("");

	const isRunning = computed(
		() => state.value === "running" || state.value === "retrying",
	);
	const isFailed = computed(
		() => state.value === "failed" || state.value === "retry-failed",
	);
	const retryExhausted = computed(() => retryCount.value >= maxRetries);

	function start() {
		retryCount.value = 0;
		state.value = "running";
		traceId.value = Date.now().toString(36);
	}

	function retry(): boolean {
		if (retryCount.value >= maxRetries) return false;
		retryCount.value += 1;
		state.value = "retrying";
		return true;
	}

	function settle(success: boolean) {
		state.value = success
			? "success"
			: retryCount.value > 0
				? "retry-failed"
				: "failed";
	}

	function reset() {
		state.value = "idle";
		retryCount.value = 0;
		traceId.value = "";
	}

	return {
		state,
		retryCount,
		traceId,
		isRunning,
		isFailed,
		retryExhausted,
		MAX_RETRIES: maxRetries,
		start,
		retry,
		settle,
		reset,
	};
}
