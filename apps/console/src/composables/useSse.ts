import { onUnmounted, ref } from "vue";

export interface SseEvent {
	type: "log" | "progress" | "done" | "error";
	message?: string;
	level?: "info" | "warn" | "error";
	step?: number;
	total?: number;
	stage?: string;
	code?: number;
	success?: boolean;
	[key: string]: unknown;
}

export interface UseSseOptions {
	onEvent?: (event: SseEvent) => void;
	onDone?: (event: SseEvent) => void;
	onError?: (event: SseEvent) => void;
	maxLogs?: number;
}

export function useSse(options: UseSseOptions = {}) {
	const { maxLogs = 500 } = options;

	const running = ref(false);
	const done = ref(false);
	const success = ref<boolean | null>(null);
	const logs = ref<{ level: string; message: string }[]>([]);
	const progress = ref(0);
	const stage = ref("");
	const errorMsg = ref("");

	let abortCtrl: AbortController | null = null;

	function reset() {
		running.value = false;
		done.value = false;
		success.value = null;
		logs.value = [];
		progress.value = 0;
		stage.value = "";
		errorMsg.value = "";
	}

	function start(url: string, body?: Record<string, unknown>) {
		abortCtrl?.abort();
		abortCtrl = null;
		reset();
		running.value = true;

		// 直接用 fetch + ReadableStream 讀 SSE（EventSource 只支援 GET）
		const controller = new AbortController();
		abortCtrl = controller;

		(async () => {
			try {
				const resp = await fetch(url, {
					method: body !== undefined ? "POST" : "GET",
					headers:
						body !== undefined ? { "Content-Type": "application/json" } : {},
					body: body !== undefined ? JSON.stringify(body) : undefined,
					signal: controller.signal,
				});

				if (!resp.ok || !resp.body) {
					throw new Error(`HTTP ${resp.status}`);
				}

				const reader = resp.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done: streamDone, value } = await reader.read();
					if (streamDone) break;

					buffer += decoder.decode(value, { stream: true });
					const parts = buffer.split("\n\n");
					buffer = parts.pop() ?? "";

					for (const part of parts) {
						const dataLine = part
							.split("\n")
							.find((l) => l.startsWith("data:"));
						if (!dataLine) continue;
						try {
							const event: SseEvent = JSON.parse(dataLine.slice(5).trim());
							handleEvent(event);
						} catch {
							// 忽略非 JSON 行
						}
					}
				}

				// stream ended cleanly
				if (!done.value) {
					handleEvent({ type: "done", success: true });
				}
			} catch (err: unknown) {
				if ((err as Error)?.name === "AbortError") return;
				running.value = false;
				errorMsg.value = (err as Error)?.message ?? "連線失敗";
			}
		})();
	}

	function handleEvent(event: SseEvent) {
		options.onEvent?.(event);

		if (event.type === "log") {
			const entry = {
				level: event.level ?? "info",
				message: event.message ?? "",
			};
			logs.value.push(entry);
			if (logs.value.length > maxLogs) {
				logs.value = logs.value.slice(-maxLogs);
			}
		} else if (event.type === "progress") {
			if (event.step !== undefined && event.total) {
				progress.value = Math.round((event.step / event.total) * 100);
			}
			if (event.stage) stage.value = event.stage;
			if (event.message) {
				logs.value.push({ level: "info", message: event.message });
			}
		} else if (event.type === "done") {
			running.value = false;
			done.value = true;
			success.value = event.success ?? true;
			options.onDone?.(event);
		} else if (event.type === "error") {
			running.value = false;
			done.value = true;
			success.value = false;
			errorMsg.value = event.message ?? "未知錯誤";
			options.onError?.(event);
		}
	}

	function stop() {
		abortCtrl?.abort();
		abortCtrl = null;
		running.value = false;
	}

	onUnmounted(() => stop());

	return {
		running,
		done,
		success,
		logs,
		progress,
		stage,
		errorMsg,
		start,
		stop,
		reset,
	};
}
