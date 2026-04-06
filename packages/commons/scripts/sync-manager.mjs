import { readVersions } from './version-tracker.mjs';

const CACHE_TTL_DAYS = 7;

/**
 * Check if resources need syncing and trigger if needed.
 * Called at runtime by dotfiles during setup.
 */
export async function syncIfNeeded() {
  const versions = readVersions();
  const stale = [];

  for (const [name, entry] of Object.entries(versions)) {
    if (entry.locked) continue;

    // No date or no SHA → needs sync
    if (!entry.date || !entry.sha) {
      stale.push(name);
      continue;
    }

    // Check TTL
    const lastSync = new Date(entry.date);
    const now = new Date();
    const daysSince = (now - lastSync) / (1000 * 60 * 60 * 24);

    if (daysSince > CACHE_TTL_DAYS) {
      stale.push(name);
    }
  }

  if (stale.length === 0) {
    return { synced: false, reason: 'all sources up to date' };
  }

  // Lazy import to avoid circular dependency at load time
  const { syncSource, SOURCES_CONFIG } = await import('./sync-sources.mjs');

  const results = [];
  for (const name of stale) {
    if (!SOURCES_CONFIG[name]) continue;
    try {
      const result = await syncSource(name, SOURCES_CONFIG[name]);
      results.push({ source: name, ...result });
    } catch (err) {
      console.warn(`Runtime sync failed for ${name}: ${err.message}`);
      results.push({ source: name, success: false, error: err.message });
    }
  }

  return { synced: true, results };
}
