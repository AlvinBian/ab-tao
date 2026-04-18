/**
 * config-sync.mjs — Claude 配置同步 Orchestrator
 *
 * 職責：
 *   1. 掃描 template 目錄，分類每個項目的同步操作
 *   2. 渲染計畫摘要並視模式確認
 *   3. 執行計畫（含 _archive/ 備份）
 *   4. 更新 state.json 與 chmod +x .sh 檔
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { APP_VERSION } from "../core/constants.mjs";
import { stateSetManaged, stateWrite } from "../state/state.mjs";
import { mergeConfig } from "./config-merge.mjs";

// ── 計畫項目型別 ────────────────────────────────────────────────

/**
 * @typedef {'create'|'mergeJson'|'overwriteFile'|'additiveKeep'|'forbiddenSkip'|'noChange'} PlanAction
 *
 * create        — home 不存在 → 直接複製
 * mergeJson     — JSON 檔 + local 有修改 → mergeConfig()
 * overwriteFile — non-JSON + 非 additive + drift → 需確認
 * additiveKeep  — ADDITIVE_DIRS 中的本地獨有檔 → 保留
 * forbiddenSkip — FORBIDDEN_DIRS → 完全跳過
 * noChange      — 內容相同，無需操作
 */

// ── 主入口 ────────────────────────────────────────────────────────

/**
 * 同步 Claude 配置
 *
 * @param {object} opts
 * @param {string}  opts.home      目標目錄（~/.claude/）
 * @param {string}  opts.template  ab-tao template 根目錄（apps/dotfiles/claude/）
 * @param {object}  opts.policy    preserve-policy.mjs 匯出的策略物件
 * @param {'interactive'|'auto'} [opts.mode='interactive']
 * @param {boolean} [opts.dryRun=false]
 */
export async function syncConfig({
	home,
	template,
	policy,
	mode = "interactive",
	dryRun = false,
}) {
	// 確保目標目錄存在
	fs.mkdirSync(home, { recursive: true });

	const plan = await buildSyncPlan(home, template, policy);
	await renderPlanSummary(plan);

	if (dryRun) {
		console.log(pc.yellow("Dry-run 模式：不執行任何寫入"));
		return;
	}

	if (mode === "interactive") {
		await confirmPlan(plan);
	}

	await executePlan(plan, home, template, policy);
	await updateStateJson(plan);
	await chmodShFiles(home);
}

// ── buildSyncPlan ─────────────────────────────────────────────────

/**
 * 掃描 template 並分類每個項目
 *
 * @param {string} home     目標目錄
 * @param {string} template template 根目錄
 * @param {object} policy   preserve-policy
 * @returns {Promise<PlanItem[]>}
 */
export async function buildSyncPlan(home, template, policy) {
	const { additiveDirs = [], forbiddenDirs = [] } = policy ?? {};

	const items = [];
	await _walkTemplate(
		template,
		template,
		home,
		additiveDirs,
		forbiddenDirs,
		items,
	);
	return items;
}

/**
 * 遞迴掃描 template 目錄樹
 */
async function _walkTemplate(
	templateRoot,
	currentDir,
	homeRoot,
	additiveDirs,
	forbiddenDirs,
	items,
) {
	let entries;
	try {
		entries = fs.readdirSync(currentDir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const srcPath = path.join(currentDir, entry.name);
		const relPath = path.relative(templateRoot, srcPath);
		const destPath = path.join(homeRoot, relPath);

		// 取第一層目錄名（用於判斷 forbidden/additive）
		const topDir = relPath.split(path.sep)[0];

		// FORBIDDEN_DIRS：完全跳過
		if (forbiddenDirs.includes(topDir)) {
			items.push({ action: "forbiddenSkip", relPath, srcPath, destPath });
			continue;
		}

		if (entry.isDirectory()) {
			await _walkTemplate(
				templateRoot,
				srcPath,
				homeRoot,
				additiveDirs,
				forbiddenDirs,
				items,
			);
			continue;
		}

		if (!entry.isFile()) continue;

		const destExists = fs.existsSync(destPath);

		// 目標不存在 → create
		if (!destExists) {
			items.push({ action: "create", relPath, srcPath, destPath });
			continue;
		}

		// 計算 sha256 比較內容
		const srcSha = _sha256(srcPath);
		const destSha = _sha256(destPath);

		// 內容相同 → noChange
		if (srcSha === destSha) {
			items.push({ action: "noChange", relPath, srcPath, destPath });
			continue;
		}

		// 內容不同

		// JSON 檔 → mergeJson
		if (entry.name.endsWith(".json")) {
			items.push({ action: "mergeJson", relPath, srcPath, destPath });
			continue;
		}

		// ADDITIVE_DIRS 中的本地獨有檔 → additiveKeep（這裡是 template 有、home 也有但不同，不覆蓋）
		if (additiveDirs.includes(topDir)) {
			items.push({ action: "additiveKeep", relPath, srcPath, destPath });
			continue;
		}

		// 其他 → overwriteFile（需確認）
		items.push({ action: "overwriteFile", relPath, srcPath, destPath });
	}
}

// ── renderPlanSummary ──────────────────────────────────────────────

/**
 * 印出計畫摘要（分類計數）
 * @param {PlanItem[]} plan
 */
export async function renderPlanSummary(plan) {
	const counts = {};
	for (const item of plan) {
		counts[item.action] = (counts[item.action] ?? 0) + 1;
	}

	const total = plan.length;
	const actionable = plan.filter(
		(i) => i.action !== "forbiddenSkip" && i.action !== "noChange",
	).length;

	const lines = [
		pc.bold("配置同步計畫"),
		`  總計 ${total} 個項目，${actionable} 個需操作`,
		"",
	];

	const labels = {
		create: `${pc.green("✚")} create         — 新增`,
		mergeJson: `${pc.blue("⊕")} mergeJson      — JSON 合併`,
		overwriteFile: `${pc.yellow("↺")} overwriteFile  — 覆蓋（需確認）`,
		additiveKeep: `${pc.dim("○")} additiveKeep   — 保留本地`,
		forbiddenSkip: `${pc.dim("⊘")} forbiddenSkip  — 禁止觸碰`,
		noChange: `${pc.dim("─")} noChange       — 無變更`,
	};

	for (const [action, count] of Object.entries(counts)) {
		lines.push(`  ${labels[action] ?? action}  ${pc.bold(String(count))} 個`);
	}

	p.log.info(lines.join("\n"));
}

// ── confirmPlan ────────────────────────────────────────────────────

/**
 * 互動式確認計畫（使用 @clack/prompts）
 * drift ≥3 先問批次 [I/A/K/S]
 *
 * @param {PlanItem[]} plan
 */
export async function confirmPlan(plan) {
	const overwriteItems = plan.filter((i) => i.action === "overwriteFile");
	if (overwriteItems.length === 0) return;

	// drift ≥3：先問批次策略
	if (overwriteItems.length >= 3) {
		const batchChoice = await p.select({
			message: `有 ${overwriteItems.length} 個非 JSON 檔案有 drift，如何處理？`,
			options: [
				{ value: "I", label: "逐一確認（Interactive）" },
				{ value: "A", label: "全部使用 ab-tao 版本（Apply all）" },
				{ value: "K", label: "全部保留本地版本（Keep all）" },
				{ value: "S", label: "全部跳過本次（Skip all）" },
			],
		});

		if (p.isCancel(batchChoice)) {
			p.log.warn("已取消，保留本地版本");
			for (const item of overwriteItems) item._skip = true;
			return;
		}

		if (batchChoice === "A") {
			// 全部標記為執行
			return;
		}
		if (batchChoice === "K" || batchChoice === "S") {
			for (const item of overwriteItems) item._skip = true;
			return;
		}
		// 'I' → fallthrough 逐一確認
	}

	// 逐一確認
	for (const item of overwriteItems) {
		const choice = await p.select({
			message: `檔案有 drift：${pc.cyan(item.relPath)}`,
			options: [
				{ value: "apply", label: "使用 ab-tao 版本（自動備份本地）" },
				{ value: "keep", label: "保留本地版本" },
				{ value: "skip", label: "跳過本次" },
			],
		});

		if (p.isCancel(choice) || choice === "keep" || choice === "skip") {
			item._skip = true;
		}
	}
}

// ── executePlan ────────────────────────────────────────────────────

/**
 * 執行計畫（含 _archive/ 備份）
 *
 * @param {PlanItem[]} plan
 * @param {string} home
 * @param {string} template
 * @param {object} policy
 */
export async function executePlan(plan, home, template, policy) {
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const archiveBase = path.join(home, "_archive", `v${APP_VERSION}-${ts}`);

	for (const item of plan) {
		try {
			await _executeItem(item, home, template, policy, archiveBase);
		} catch (err) {
			p.log.warn(`執行 ${item.relPath} 失敗：${err.message}`);
		}
	}
}

async function _executeItem(item, home, template, policy, archiveBase) {
	const { action, srcPath, destPath, relPath } = item;

	switch (action) {
		case "create": {
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.copyFileSync(srcPath, destPath);
			p.log.success(`  ${pc.green("✚")} ${relPath}`);
			break;
		}

		case "mergeJson": {
			const tplContent = JSON.parse(fs.readFileSync(srcPath, "utf8"));
			const localContent = JSON.parse(fs.readFileSync(destPath, "utf8"));
			const merged = mergeConfig(tplContent, localContent, policy);

			// 備份舊版本
			_archiveFile(destPath, relPath, archiveBase);

			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.writeFileSync(
				destPath,
				`${JSON.stringify(merged, null, 2)}\n`,
				"utf8",
			);
			p.log.success(`  ${pc.blue("⊕")} ${relPath} (merged)`);
			break;
		}

		case "overwriteFile": {
			if (item._skip) {
				p.log.info(`  ${pc.dim("○")} ${relPath} (跳過)`);
				break;
			}
			// 備份舊版本
			_archiveFile(destPath, relPath, archiveBase);

			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.copyFileSync(srcPath, destPath);
			p.log.success(`  ${pc.yellow("↺")} ${relPath}`);
			break;
		}

		case "additiveKeep":
		case "noChange":
		case "forbiddenSkip":
			// 不做任何事
			break;

		default:
			p.log.warn(`  未知操作：${action} for ${relPath}`);
	}
}

/**
 * 備份檔案到 _archive/
 */
function _archiveFile(srcPath, relPath, archiveBase) {
	if (!fs.existsSync(srcPath)) return;
	const archiveDest = path.join(archiveBase, relPath);
	fs.mkdirSync(path.dirname(archiveDest), { recursive: true });
	fs.copyFileSync(srcPath, archiveDest);
}

// ── updateStateJson ────────────────────────────────────────────────

/**
 * 更新 ~/.claude/.ab-tao/state.json
 * @param {PlanItem[]} plan
 */
export async function updateStateJson(plan) {
	const now = new Date().toISOString();

	for (const item of plan) {
		if (
			item.action === "forbiddenSkip" ||
			item.action === "noChange" ||
			item.action === "additiveKeep" ||
			item._skip
		) {
			continue;
		}

		if (!fs.existsSync(item.destPath)) continue;

		const sha256 = _sha256(item.destPath);
		stateSetManaged(item.relPath, {
			sha256,
			source: `ab-tao:${item.srcPath}`,
			installedAt: now,
			userOverride: false,
		});
	}

	// 更新安裝時間與版本
	stateWrite((s) => {
		s.installedAt = now;
		s.abTaoVersion = APP_VERSION;
		return s;
	});
}

// ── chmodShFiles ───────────────────────────────────────────────────

/**
 * 對 home 下所有 .sh 執行 chmod +x
 * @param {string} home
 */
export async function chmodShFiles(home) {
	_walkShFiles(home, (filePath) => {
		try {
			fs.chmodSync(filePath, 0o755);
		} catch {
			/* 非致命 */
		}
	});
}

function _walkShFiles(dir, callback) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// 跳過 _archive（避免大量遞迴）
			if (entry.name === "_archive") continue;
			_walkShFiles(fullPath, callback);
		} else if (entry.isFile() && entry.name.endsWith(".sh")) {
			callback(fullPath);
		}
	}
}

// ── 工具 ─────────────────────────────────────────────────────────

function _sha256(filePath) {
	try {
		const content = fs.readFileSync(filePath);
		return crypto.createHash("sha256").update(content).digest("hex");
	} catch {
		return null;
	}
}
