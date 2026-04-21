import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";
import { defineConfig } from "vite";

const API_PORT = process.env.VITE_API_PORT ?? "5478";

export default defineConfig({
	base: "./",
	define: {
		// 注入 package.json 版本號，供 ConsoleLayout 顯示
		"import.meta.env.VITE_APP_VERSION": JSON.stringify(
			process.env.npm_package_version ?? "dev",
		),
	},
	plugins: [
		vue(),
		// 按需自動引入 Element Plus 元件 + composable
		AutoImport({
			resolvers: [ElementPlusResolver({ importStyle: "css" })],
			imports: ["vue", "vue-router", "pinia"],
			dts: "src/auto-imports.d.ts",
		}),
		Components({
			resolvers: [ElementPlusResolver({ importStyle: "css" })],
			dirs: ["src/components", "src/charts"],
			dts: "src/components.d.ts",
		}),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: `http://localhost:${API_PORT}`,
				changeOrigin: true,
			},
		},
	},
	preview: {
		proxy: {
			"/api": {
				target: `http://localhost:${API_PORT}`,
				changeOrigin: true,
			},
		},
	},
	build: {
		// 現代瀏覽器目標：輸出更精簡（無 legacy polyfill）
		target: "es2020",
		// 跳過 gzip 大小計算，加速 CI build（實際 gzip 由 CDN/nginx 處理）
		reportCompressedSize: false,
		// element-plus + echarts 是已知大包，壓制非必要警告
		chunkSizeWarningLimit: 800,
		rollupOptions: {
			output: {
				// 按套件邊界切 chunk，充分利用瀏覽器快取
				manualChunks(id) {
					// ECharts 全家桶（zrender 是其渲染引擎，必須同 chunk）
					if (
						id.includes("/node_modules/echarts") ||
						id.includes("/node_modules/vue-echarts") ||
						id.includes("/node_modules/zrender")
					) {
						return "vendor-echarts";
					}
					// Element Plus 元件（已 tree-shaken，僅含使用到的元件）
					if (id.includes("/node_modules/element-plus")) {
						return "vendor-element-plus";
					}
					// @element-plus/icons-vue（獨立 chunk，按需載入）
					if (id.includes("/node_modules/@element-plus")) {
						return "vendor-element-plus-icons";
					}
					// Vue 生態（vue / vue-router / pinia / @vue/*）
					if (
						id.includes("/node_modules/vue") ||
						id.includes("/node_modules/@vue") ||
						id.includes("/node_modules/pinia")
					) {
						return "vendor-vue";
					}
					// 其餘 node_modules（lodash-es 等小工具）
					if (id.includes("/node_modules/")) {
						return "vendor";
					}
				},
			},
		},
	},
});
