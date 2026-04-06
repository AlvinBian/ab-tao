/**
 * Bridge module — exposes @ab-tao/commons capabilities to dotfiles.
 *
 * Re-exports commons' security validation, version tracking, and tech detection
 * so dotfiles modules can import from a single local entry point.
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

// ── Security ─────────────────────────────────────────────────────
// ── Version Tracking ─────────────────────────────────────────────
// ── Resource Loading ─────────────────────────────────────────────
// ── Tech Detection ───────────────────────────────────────────────
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
 * Initialize commons resources — sync if stale, then load.
 * @param {object} config - ResourceLoader config
 * @returns {Promise<object>} Integrated resources
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
