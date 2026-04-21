import { onMounted, onUnmounted, ref } from "vue";

/**
 * 解析 Element Plus / 主題 CSS 變數成實色，回傳 ref。
 * ECharts canvas 不解析 `var(--el-color-primary)`，需於 runtime 取得 computed value。
 * 同時監聽 prefers-color-scheme 與 documentElement class 變化（dark mode 切換），確保跟隨主題更新。
 */
export function useElCssVar(name: string, fallback = "#409eff") {
	const value = ref(fallback);

	function read() {
		const v = getComputedStyle(document.documentElement)
			.getPropertyValue(name)
			.trim();
		if (v) value.value = v;
	}

	let mql: MediaQueryList | null = null;
	let observer: MutationObserver | null = null;

	onMounted(() => {
		read();
		mql = window.matchMedia("(prefers-color-scheme: dark)");
		mql.addEventListener("change", read);
		observer = new MutationObserver(read);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	});

	onUnmounted(() => {
		mql?.removeEventListener("change", read);
		observer?.disconnect();
	});

	return value;
}
