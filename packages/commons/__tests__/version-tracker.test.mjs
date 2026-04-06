import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSIONS_PATH = path.resolve(__dirname, '../.versions.json');

let originalContent;

beforeEach(() => {
  originalContent = fs.readFileSync(VERSIONS_PATH, 'utf8');
});

afterEach(() => {
  fs.writeFileSync(VERSIONS_PATH, originalContent);
});

// Dynamic import to get fresh module state
async function loadTracker() {
  const timestamp = Date.now();
  // Bust module cache by using query param
  return import(`../scripts/version-tracker.mjs?t=${timestamp}`);
}

describe('version-tracker', () => {
  it('should read existing versions', async () => {
    const { readVersions } = await loadTracker();
    const versions = readVersions();
    assert.ok(versions.ecc);
    assert.ok(versions.superpowers);
    assert.equal(versions.ecc.locked, false);
  });

  it('should record a sync with SHA and date', async () => {
    const { recordSync, readVersions } = await loadTracker();
    const sha = 'abc123def456';
    const result = recordSync('ecc', sha);
    assert.equal(result, true);

    const versions = readVersions();
    assert.equal(versions.ecc.sha, sha);
    assert.ok(versions.ecc.date);
  });

  it('should not update locked sources', async () => {
    const { lockSource, recordSync, readVersions } = await loadTracker();
    lockSource('ecc');
    const result = recordSync('ecc', 'new-sha');
    assert.equal(result, false);

    const versions = readVersions();
    assert.notEqual(versions.ecc.sha, 'new-sha');
  });

  it('should throw on unknown source', async () => {
    const { recordSync } = await loadTracker();
    assert.throws(() => recordSync('unknown-source', 'sha'), /Unknown source/);
  });

  it('should detect when sync is needed', async () => {
    const { needsSync, recordSync } = await loadTracker();

    // Empty SHA → needs sync
    assert.equal(needsSync('ecc', 'remote-sha'), true);

    // After recording → same SHA means no sync needed
    recordSync('ecc', 'remote-sha');
    assert.equal(needsSync('ecc', 'remote-sha'), false);

    // Different SHA → needs sync
    assert.equal(needsSync('ecc', 'different-sha'), true);
  });

  it('should lock and unlock sources', async () => {
    const { lockSource, unlockSource, needsSync, readVersions } = await loadTracker();

    lockSource('ecc');
    assert.equal(readVersions().ecc.locked, true);
    assert.equal(needsSync('ecc', 'any-sha'), false);

    unlockSource('ecc');
    assert.equal(readVersions().ecc.locked, false);
  });
});
