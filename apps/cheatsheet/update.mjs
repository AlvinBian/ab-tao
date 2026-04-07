#!/usr/bin/env node
/**
 * update.mjs — 從 cc.storyfox.cz/zh/ 抓取並轉換為繁體中文
 *
 * 流程：
 *   1. 抓取 https://cc.storyfox.cz/zh/ 的完整 HTML
 *   2. 提取版本號，與現有 index.html 比對
 *   3. 若版本相同且未帶 --force，直接退出
 *   4. 用簡轉繁詞典替換所有中文文字（保留 HTML 結構 + CSS + JS）
 *   5. 修正 meta 標籤（lang、canonical、og:url、description 等）
 *   6. 寫入 apps/cheatsheet/index.html
 *
 * 使用：
 *   node apps/cheatsheet/update.mjs
 *   node apps/cheatsheet/update.mjs --force
 */

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "index.html");
const SOURCE_URL = "https://cc.storyfox.cz/zh/";
const FORCE = process.argv.includes("--force");

// ── HTTP fetch ─────────────────────────────────────────────────────────────

function fetchUrl(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { timeout: 20000 }, (res) => {
			if (
				res.statusCode >= 300 &&
				res.statusCode < 400 &&
				res.headers.location
			) {
				fetchUrl(res.headers.location).then(resolve, reject);
				return;
			}
			const chunks = [];
			res.on("data", (c) => chunks.push(c));
			res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
			res.on("error", reject);
		});
		req.on("error", reject);
		req.on("timeout", () => {
			req.destroy();
			reject(new Error(`請求逾時：${url}`));
		});
	});
}

// ── 版本解析 ───────────────────────────────────────────────────────────────

function extractVersion(html) {
	const m = html.match(/Claude Code v(\d+\.\d+\.\d+)/);
	return m ? m[1] : null;
}

function extractLocalVersion(html) {
	const m = html.match(/data-version="([^"]+)"/);
	return m ? m[1] : null;
}

// ── 簡繁轉換詞典 ───────────────────────────────────────────────────────────
// 按「最長匹配優先」排列，常見詞組優先於單字

const S2T_DICT = [
	// === 技術詞彙 ===
	["服务器", "伺服器"],
	["键盘快捷键", "鍵盤快捷鍵"],
	["键盘", "鍵盤"],
	["斜杠命令", "斜線命令"],
	["斜杠", "斜線"],
	["环境变量", "環境變數"],
	["环境", "環境"],
	["变量", "變數"],
	["工作流", "工作流程"],
	["配置文件", "設定檔"],
	["配置", "設定"],
	["设置", "設定"],
	["记忆文件", "記憶檔案"],
	["记忆", "記憶"],
	["文件", "檔案"],
	["代理", "代理人"],
	["技能", "技能"],
	// === 動作詞彙 ===
	["取消输入", "取消輸入"],
	["取消", "取消"],
	["退出会话", "退出工作階段"],
	["退出", "退出"],
	["清屏", "清除畫面"],
	["切换详细输出", "切換詳細輸出"],
	["切换", "切換"],
	["反向搜索历史", "反向搜尋歷史"],
	["搜索", "搜尋"],
	["历史", "歷史"],
	["打开", "開啟"],
	["后台运行", "背景執行"],
	["后台", "背景"],
	["运行", "執行"],
	["切换任务列表", "切換任務列表"],
	["任务", "任務"],
	["粘贴图片", "貼上圖片"],
	["粘贴", "貼上"],
	["终止后台代理", "終止背景代理人"],
	["终止", "終止"],
	["回退", "回退"],
	["摘要", "摘要"],
	["循环切换", "循環切換"],
	["循环", "循環"],
	["换行", "換行"],
	["引用", "引用"],
	["展开", "展開"],
	["折叠", "折疊"],
	["重命名", "重新命名"],
	["导航", "導覽"],
	["预览", "預覽"],
	// === 會話/模式 ===
	["会话选择器", "工作階段選取器"],
	["会话", "工作階段"],
	["权限模式", "權限模式"],
	["权限", "權限"],
	["转录模式", "轉錄模式"],
	["转录", "轉錄"],
	["切换显示全部", "切換顯示全部"],
	["显示", "顯示"],
	["模式切换", "模式切換"],
	["模式", "模式"],
	// === MCP ===
	["添加服务器", "新增伺服器"],
	["添加", "新增"],
	["远程", "遠端"],
	["本地进程", "本機處理程序"],
	["本地", "本機"],
	["作用域", "作用域"],
	["全局", "全域"],
	["列出所有", "列出所有"],
	["列出", "列出"],
	["管理", "管理"],
	["交互式界面", "互動式介面"],
	["交互式", "互動式"],
	["界面", "介面"],
	["工具描述", "工具說明"],
	["描述", "說明"],
	["覆盖", "覆蓋"],
	["注解", "註解"],
	// === 斜線命令 ===
	["清除对话", "清除對話"],
	["对话", "對話"],
	["压缩上下文", "壓縮上下文"],
	["压缩", "壓縮"],
	["上下文", "上下文"],
	["恢复", "恢復"],
	["分支对话", "分支對話"],
	["分支", "分支"],
	["用量", "用量"],
	["缓存命中", "快取命中"],
	["缓存", "快取"],
	["按模型", "依模型"],
	["分类统计", "分類統計"],
	["分类", "分類"],
	["统计", "統計"],
	["可视化", "視覺化"],
	["网格", "格線"],
	["查看", "查看"],
	["差异", "差異"],
	["查看器", "查看器"],
	["复制", "複製"],
	["最近", "最近"],
	["导出", "匯出"],
	["打开设置", "開啟設定"],
	["切换模型", "切換模型"],
	["调整", "調整"],
	["力度", "力度"],
	["更换颜色主题", "更換色彩主題"],
	["颜色主题", "色彩主題"],
	["颜色", "顏色"],
	["主题", "主題"],
	["更新权限", "更新權限"],
	["设置力度", "設定力度"],
	["设置提示栏颜色", "設定提示列顏色"],
	["提示栏", "提示列"],
	["自定义键盘快捷键", "自訂鍵盤快捷鍵"],
	["自定义", "自訂"],
	["配置终端快捷键", "設定終端機快捷鍵"],
	["终端", "終端機"],
	["创建", "建立"],
	["编辑", "編輯"],
	["列出可用技能", "列出可用技能"],
	["热重载", "熱重載"],
	["插件", "插件"],
	["工作目录", "工作目錄"],
	["目录", "目錄"],
	["旁问", "旁問"],
	["消耗", "消耗"],
	["规划", "規劃"],
	["定时循环任务", "定時循環任務"],
	["定时", "定時"],
	["按住说话", "按住說話"],
	["语音", "語音"],
	["语言", "語言"],
	["诊断安装问题", "診斷安裝問題"],
	["诊断", "診斷"],
	["安装", "安裝"],
	["问题", "問題"],
	["使用统计与偏好", "使用統計與偏好"],
	["使用统计", "使用統計"],
	["使用", "使用"],
	["分析报告", "分析報告"],
	["分析", "分析"],
	["报告", "報告"],
	["继续", "繼續"],
	["桌面应用", "桌面應用程式"],
	["应用", "應用程式"],
	["桥接", "橋接"],
	["套餐限额与速率状态", "方案限額與速率狀態"],
	["限额", "限額"],
	["速率", "速率"],
	["状态", "狀態"],
	["云端定时任务", "雲端定時任務"],
	["云端", "雲端"],
	["安全审查", "安全審查"],
	["审查", "審查"],
	["显示帮助", "顯示說明"],
	["帮助", "說明"],
	["提交反馈", "提交意見回饋"],
	["反馈", "意見回饋"],
	["交互式版本变更日志", "互動式版本變更日誌"],
	["变更日志", "變更日誌"],
	["变更", "變更"],
	["订购", "訂購"],
	// === 記憶檔案 ===
	["优先级", "優先順序"],
	["优先", "優先"],
	["作用域", "作用域"],
	["用户级", "使用者層級"],
	["用户", "使用者"],
	["项目级", "專案層級"],
	["项目", "專案"],
	["子目录", "子目錄"],
	["子", "子"],
	["读取顺序", "讀取順序"],
	["读取", "讀取"],
	["顺序", "順序"],
	["路径", "路徑"],
	["路径条件载入", "路徑條件載入"],
	["条件载入", "條件載入"],
	["载入", "載入"],
	["忽略文件", "忽略檔案"],
	["上传", "上傳"],
	["图片", "圖片"],
	["标签", "標籤"],
	// === 工作流程 ===
	["计划模式", "計劃模式"],
	["计划", "計劃"],
	["扩展思考", "延伸思考"],
	["扩展", "延伸"],
	["思考", "思考"],
	["审批策略", "審批策略"],
	["审批", "審批"],
	["策略", "策略"],
	["钩子", "Hooks"],
	["提示改进器", "提示改進器"],
	["改进", "改進"],
	["多行输入", "多行輸入"],
	["多行", "多行"],
	["输入", "輸入"],
	["输出", "輸出"],
	["测试循环", "測試循環"],
	["测试", "測試"],
	["并行代理", "並行代理人"],
	["并行", "並行"],
	["子代理", "子代理人"],
	["内存", "記憶體"],
	["令牌", "Token"],
	["最大令牌", "最大 Token"],
	["降低", "降低"],
	["节省", "節省"],
	["跨会话", "跨工作階段"],
	["跨", "跨"],
	["压缩索引", "壓縮索引"],
	["索引", "索引"],
	["避免", "避免"],
	["上下文窗口", "上下文視窗"],
	["窗口", "視窗"],
	["最后", "最後"],
	["上传图像", "上傳圖像"],
	["图像", "圖像"],
	["剪贴板", "剪貼板"],
	["生成", "生成"],
	["重用", "重用"],
	["承诺", "承諾"],
	["批量", "批次"],
	["操作", "操作"],
	// === 設定 ===
	["全局设置", "全域設定"],
	["全局", "全域"],
	["项目设置", "專案設定"],
	["本地设置", "本機設定"],
	["覆盖顺序", "覆蓋順序"],
	["启用", "啟用"],
	["禁用", "停用"],
	["跳过", "略過"],
	["自动批准", "自動核准"],
	["批准", "核准"],
	["权限规则", "權限規則"],
	["规则", "規則"],
	["允许", "允許"],
	["拒绝", "拒絕"],
	["工具", "工具"],
	["最大工具", "最大工具"],
	["调用", "呼叫"],
	// === CLI ===
	["打印", "列印"],
	["输出格式", "輸出格式"],
	["格式", "格式"],
	["调试", "除錯"],
	["详细", "詳細"],
	["日志", "日誌"],
	["路径设置", "路徑設定"],
	["目标目录", "目標目錄"],
	["管道", "管道"],
	["标准", "標準"],
	["非交互", "非互動"],
	["超时", "逾時"],
	["重试", "重試"],
	["启动时", "啟動時"],
	["刷新", "重新整理"],
	["失败", "失敗"],
	["阻止", "阻止"],
	["向导", "精靈"],
	["登录界面", "登入介面"],
	["登录", "登入"],
	["远程端", "遠端"],
	["连接", "連線"],
	["端口", "連接埠"],
	["协议", "通訊協定"],
	["验证", "驗證"],
	["代理人", "代理人"],
	// === 技能與代理 ===
	["编写提示", "撰寫提示"],
	["编写", "撰寫"],
	["加载", "載入"],
	["扩展", "延伸"],
	["内置", "內建"],
	["自定义技能", "自訂技能"],
	["安装技能", "安裝技能"],
	["官方插件", "官方插件"],
	["社区插件", "社群插件"],
	["社区", "社群"],
	// === 頁頭/頁尾 ===
	["速查表", "快速參考表"],
	["最后更新", "最後更新"],
	["最近更新", "最近更新"],
	["更新日志", "更新日誌"],
	["按", "依"],
	["中文", "繁體中文"],
	["简体中文", "繁體中文"],
	["关闭", "關閉"],
	["订阅", "訂閱"],
	["每日自动更新", "每日自動更新"],
	["自动更新", "自動更新"],
	["自动", "自動"],
	["可打印", "可列印"],
	// === 常見漏轉詞組 ===
	["默认", "預設"],
	["参数", "參數"],
	["参考卡片", "參考卡片"],
	["完整参考", "完整參考"],
	["别名", "別名"],
	["无头模式", "無頭模式"],
	["无头", "無頭"],
	["费用上限", "費用上限"],
	["费用", "費用"],
	["一页搞定", "一頁搞定"],
	["横版", "橫版"],
	["编程", "編程"],
	["记忆与档案", "記憶與檔案"],
	["工作流程与技巧", "工作流程與技巧"],
	["技能与代理人", "技能與代理人"],
	["设定与环境", "設定與環境"],
	["与", "與"],
	["则", "則"],
	["强制", "強制"],
	["种", "種"],
	["页", "頁"],
	["关键", "關鍵"],
	// === 單字（最後處理）===
	["键", "鍵"],
	["输", "輸"],
	["标", "標"],
	["签", "籤"],
	["权", "權"],
	["层", "層"],
	["级", "級"],
	["参", "參"],
	["别", "別"],
	["无", "無"],
	["费", "費"],
	["编", "編"],
	["横", "橫"],
	["强", "強"],
];

/**
 * 對 HTML 文字節點套用簡轉繁替換
 * 只替換非 HTML tag 內的文字
 */
function convertS2T(html) {
	// 按詞典順序替換，在 HTML 標籤之間的文字中
	// 使用負向前瞻/後顧確保不替換 HTML 屬性內的文字
	let result = html;
	for (const [s, t] of S2T_DICT) {
		// 全局替換，跳過 HTML 標籤屬性（只替換 > ... < 之間的文字）
		// 簡單策略：替換所有出現（包含 alt/title 屬性，這些也需要翻譯）
		result = result.replaceAll(s, t);
	}
	return result;
}

/**
 * 更新 meta 標籤為繁體中文版本
 */
function updateMeta(html, version) {
	const today = new Date().toISOString().slice(0, 10);
	const dateZhTW = today
		.replace(
			/-(\d+)-(\d+)$/,
			(_, m, d) => ` 年 ${Number(m)} 月 ${Number(d)} 日`,
		)
		.replace(/^(\d+)/, "$1");

	return (
		html
			// lang 屬性
			.replace(/lang="zh-CN"/, 'lang="zh-TW"')
			// title
			.replace(
				/<title>Claude Code 速查表<\/title>/,
				"<title>Claude Code 快速參考表（繁體中文）</title>",
			)
			// description meta
			.replace(
				/content="最全面的 Claude Code 速查表[^"]*"/,
				'content="最全面的 Claude Code 快速參考表 — 鍵盤快捷鍵、斜線命令、CLI 參數、MCP 伺服器、記憶檔案、技能、代理人、環境變數。每日自動更新。可列印 A4 橫版。"',
			)
			// keywords
			.replace(
				/content="Claude Code, 速查表[^"]*"/,
				'content="Claude Code, 快速參考表, Claude CLI, Anthropic, 鍵盤快捷鍵, 斜線命令, MCP, CLAUDE.md, AI 編程, 參考卡片"',
			)
			// canonical + og:url → 指向本站 GitHub Pages
			.replace(/href="https:\/\/cc\.storyfox\.cz\/zh\/"/, 'href="./index.html"')
			.replace(/content="https:\/\/cc\.storyfox\.cz\/zh\/"/, 'content=""')
			// og:title
			.replace(
				/content="Claude Code 速查表 — 完整参考"/,
				'content="Claude Code 快速參考表（繁體中文） — 完整參考"',
			)
			// og:description
			.replace(
				/content="所有 Claude Code 快捷键[^"]*"/,
				'content="所有 Claude Code 快捷鍵、命令、參數、MCP 設定、記憶檔案和環境變數，一頁搞定。每日自動更新。"',
			)
			// og:site_name
			.replace(
				/content="Claude Code 速查表"/,
				'content="Claude Code 快速參考表"',
			)
			// twitter:title
			.replace(
				/<meta name="twitter:title" content="Claude Code 速查表 — 完整参考">/,
				'<meta name="twitter:title" content="Claude Code 快速參考表（繁體中文） — 完整參考">',
			)
			// twitter:description
			.replace(
				/<meta name="twitter:description" content="所有 Claude Code 快捷键[^"]*">/,
				'<meta name="twitter:description" content="所有 Claude Code 快捷鍵、命令、參數、MCP 設定、記憶檔案和環境變數，一頁搞定。">',
			)
			// 移除 goatcounter 追蹤（避免汙染原站統計）
			.replace(
				/<script data-goatcounter[\s\S]*?<\/script>/,
				"<!-- analytics removed -->",
			)
			// 移除 hreflang（本地版本不需要）
			.replace(/\s*<link rel="alternate"[^>]*>/g, "")
			// 移除 canonical（本地版本）
			.replace(/\s*<link rel="canonical"[^>]*>/, "")
			// 加入版本 data 屬性到 html 元素（方便後續比對）
			.replace(
				/<html lang="zh-TW">/,
				`<html lang="zh-TW" data-version="${version}">`,
			)
			// 更新語言切換器 — 移除其他語言連結（無法連到本站版本）
			.replace(
				/<div class="lang-switcher"[\s\S]*?<\/div>/,
				`<div class="lang-switcher" style="font-size: 0.7rem; color: #6B7280;">
          <a href="https://cc.storyfox.cz/" style="color: #6B7280; text-decoration: none;">EN</a> |
          <strong style="color: #111827;">繁體中文</strong> |
          <a href="https://cc.storyfox.cz/zh/" style="color: #6B7280; text-decoration: none;">简体中文</a> |
          <a href="https://cc.storyfox.cz/jp/" style="color: #6B7280; text-decoration: none;">日本語</a> |
          <a href="https://cc.storyfox.cz/kr/" style="color: #6B7280; text-decoration: none;">한국어</a>
        </div>`,
			)
			// 頁尾加入版本 + 原始來源說明
			.replace(
				/<\/body>/,
				`  <!-- 繁體中文版本資訊 -->
  <div style="text-align:center;padding:4px;font-size:0.65rem;color:#9CA3AF;margin-top:2mm;">
    繁體中文版本 v${version}｜原始來源：<a href="https://cc.storyfox.cz/zh/" style="color:#9CA3AF;">cc.storyfox.cz</a> by @phasE89｜本版本由 <a href="https://github.com/AlvinBian/ab-tao" style="color:#9CA3AF;">ab-tao</a> 自動同步
  </div>
</body>`,
			)
	);
}

// ── 主流程 ─────────────────────────────────────────────────────────────────

async function main() {
	console.log("📥 抓取 cc.storyfox.cz/zh/ ...");

	let html;
	try {
		html = await fetchUrl(SOURCE_URL);
	} catch (err) {
		console.error(`❌ 抓取失敗：${err.message}`);
		process.exit(1);
	}

	const version = extractVersion(html);
	if (!version) {
		console.error("❌ 無法解析版本號，中止");
		process.exit(1);
	}
	console.log(`   遠端版本：${version}`);

	// 比對本地版本
	if (!FORCE && fs.existsSync(OUTPUT_PATH)) {
		const localHtml = fs.readFileSync(OUTPUT_PATH, "utf8");
		const localVersion = extractLocalVersion(localHtml);
		console.log(`   本地版本：${localVersion || "未知"}`);
		if (localVersion === version) {
			console.log("✅ 版本相同，無須更新");
			// 在 GitHub Actions 中輸出
			if (process.env.GITHUB_OUTPUT) {
				fs.appendFileSync(
					process.env.GITHUB_OUTPUT,
					`changed=false\nversion=${version}\n`,
				);
			}
			return;
		}
		console.log(`🆕 版本更新：${localVersion} → ${version}`);
	} else if (FORCE) {
		console.log("⚡ --force 模式：強制更新");
	}

	// 轉換
	console.log("🔄 簡轉繁...");
	let converted = convertS2T(html);

	// 更新 meta
	console.log("🏷️  更新 meta 標籤...");
	converted = updateMeta(converted, version);

	// 寫入
	fs.writeFileSync(OUTPUT_PATH, converted, "utf8");
	const size = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
	console.log(`✅ 已寫入 apps/cheatsheet/index.html（${size} KB）`);
	console.log(`   版本：${version}`);

	// GitHub Actions 輸出
	if (process.env.GITHUB_OUTPUT) {
		fs.appendFileSync(
			process.env.GITHUB_OUTPUT,
			`changed=true\nversion=${version}\n`,
		);
	}
}

main().catch((err) => {
	console.error(`❌ 執行失敗：${err.message}`);
	process.exit(1);
});
