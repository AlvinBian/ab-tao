/**
 * 橋接模組 — 將 @ab-tao/commons 的能力暴露給 dotfiles。
 *
 * 重新匯出 commons 的安全驗證、版本追蹤與技術偵測，
 * 讓 dotfiles 模組可從單一本地入口匯入。
 */
import {
  detectTechStack,
  lockSource,
  needsSync,
  ResourceLoader,
  readVersions,
  recordSync,
  sanitizeContent,
  syncIfNeeded,
  TECH_TO_LANG,
  unlockSource,
  validateContent,
  validateDirectory,
  validateFileContent,
  writeVersions,
} from '@ab-tao/commons';

export {
  detectTechStack,
  lockSource,
  needsSync,
  ResourceLoader,
  readVersions,
  recordSync,
  sanitizeContent,
  syncIfNeeded,
  TECH_TO_LANG,
  unlockSource,
  validateContent,
  validateDirectory,
  validateFileContent,
  writeVersions,
};

/**
 * 初始化 commons 資源 — 若過期則同步，然後載入。
 * @param {object} config - ResourceLoader 設定
 * @returns {Promise<object>} 整合後的資源
 */
export async function initializeCommons(config = {}) {
  const syncResult = await syncIfNeeded();
  const loader = new ResourceLoader(config);
  const resources = await loader.loadResources();

  return {
    syncResult,
    resources,
    commands: resources.ecc?.commands || [],
    agents: resources.ecc?.agents || [],
    rules: resources.ecc?.rules || [],
  };
}
