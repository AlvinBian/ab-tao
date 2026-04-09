/**
 * commons 路徑常數
 *
 * 提供 AI 資源目錄等路徑，供其他 package 透過 @ab-tao/commons/paths 引用。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMONS_ROOT = path.resolve(__dirname, "..");

/** AI 資源根目錄（由 pnpm run c:sync 同步） */
export const RESOURCES_DIR = path.join(
	COMMONS_ROOT,
	"resources",
	"ai",
	"sources",
);

/** ECC 資源目錄 */
export const ECC_DIR = path.join(RESOURCES_DIR, "ecc");

/** 翻譯檔 */
export const TRANSLATIONS_PATH = path.join(
	COMMONS_ROOT,
	"resources",
	"translations.json",
);

/** .versions.json */
export const VERSIONS_PATH = path.join(COMMONS_ROOT, ".versions.json");
