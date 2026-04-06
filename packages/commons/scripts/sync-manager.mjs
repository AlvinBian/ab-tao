import { readVersions } from './version-tracker.mjs';

const CACHE_TTL_DAYS = 7;

/**
 * 檢查資源是否需要同步，若需要則觸發同步。
 * 由 dotfiles 在 setup 時呼叫。
 */
export async function syncIfNeeded() {
  const versions = readVersions();
  const stale = [];

  for (const [name, entry] of Object.entries(versions)) {
    if (entry.locked) continue;

    // 無日期或無 SHA → 需要同步
    if (!entry.date || !entry.sha) {
      stale.push(name);
      continue;
    }

    // 檢查 TTL
    const lastSync = new Date(entry.date);
    const now = new Date();
    const daysSince = (now - lastSync) / (1000 * 60 * 60 * 24);

    if (daysSince > CACHE_TTL_DAYS) {
      stale.push(name);
    }
  }

  if (stale.length === 0) {
    return { synced: false, reason: '所有來源皆為最新' };
  }

  // 延遲載入以避免循環依賴
  const { syncSource, SOURCES_CONFIG } = await import('./sync-sources.mjs');

  const results = [];
  for (const name of stale) {
    if (!SOURCES_CONFIG[name]) continue;
    try {
      const result = await syncSource(name, SOURCES_CONFIG[name]);
      results.push({ source: name, ...result });
    } catch (err) {
      console.warn(`${name} 執行期同步失敗: ${err.message}`);
      results.push({ source: name, success: false, error: err.message });
    }
  }

  return { synced: true, results };
}
