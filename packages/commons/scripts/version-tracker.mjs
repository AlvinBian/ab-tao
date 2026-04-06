import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSIONS_PATH = path.resolve(__dirname, '../.versions.json');

/**
 * Read current version records.
 * @returns {Record<string, object>}
 */
export function readVersions() {
  if (!fs.existsSync(VERSIONS_PATH)) return {};
  return JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'));
}

/**
 * Write version records back to disk.
 * @param {Record<string, object>} versions
 */
export function writeVersions(versions) {
  fs.writeFileSync(VERSIONS_PATH, JSON.stringify(versions, null, 2) + '\n');
}

/**
 * Update a single source's version after successful sync.
 * @param {string} sourceName
 * @param {string} sha - Git commit SHA
 */
export function recordSync(sourceName, sha) {
  const versions = readVersions();
  if (!versions[sourceName]) {
    throw new Error(`Unknown source: ${sourceName}`);
  }

  if (versions[sourceName].locked) {
    console.warn(`Source "${sourceName}" is locked at ${versions[sourceName].sha}, skipping update`);
    return false;
  }

  versions[sourceName].sha = sha;
  versions[sourceName].date = new Date().toISOString().split('T')[0];
  writeVersions(versions);
  return true;
}

/**
 * Check if a source needs syncing (SHA changed or empty).
 * @param {string} sourceName
 * @param {string} remoteSha - Current remote HEAD SHA
 * @returns {boolean}
 */
export function needsSync(sourceName, remoteSha) {
  const versions = readVersions();
  const entry = versions[sourceName];
  if (!entry) return true;
  if (entry.locked) return false;
  if (!entry.sha) return true;
  return entry.sha !== remoteSha;
}

/**
 * Lock a source at its current version.
 * @param {string} sourceName
 */
export function lockSource(sourceName) {
  const versions = readVersions();
  if (!versions[sourceName]) {
    throw new Error(`Unknown source: ${sourceName}`);
  }
  versions[sourceName].locked = true;
  writeVersions(versions);
}

/**
 * Unlock a source to allow syncing.
 * @param {string} sourceName
 */
export function unlockSource(sourceName) {
  const versions = readVersions();
  if (!versions[sourceName]) {
    throw new Error(`Unknown source: ${sourceName}`);
  }
  versions[sourceName].locked = false;
  writeVersions(versions);
}
