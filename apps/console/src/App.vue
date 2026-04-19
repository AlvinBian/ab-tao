<script setup lang="ts">
import { onMounted } from "vue";

// 跟隨系統深色模式偏好
onMounted(() => {
	const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	if (isDark) {
		document.documentElement.classList.add("dark");
	}
	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", (e) => {
			document.documentElement.classList.toggle("dark", e.matches);
		});
});
</script>

<template>
  <RouterView />
</template>
