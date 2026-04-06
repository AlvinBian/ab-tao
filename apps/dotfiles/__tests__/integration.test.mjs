import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectTechStack,
  initializeCommons,
  ResourceLoader,
  sanitizeContent,
  validateFileContent,
} from '../lib/external/commons-integration.mjs';

describe('commons-integration bridge', () => {
  it('should re-export security validation', () => {
    assert.equal(typeof validateFileContent, 'function');
    assert.equal(typeof sanitizeContent, 'function');
  });

  it('should validate file content via commons', () => {
    const safe = validateFileContent('test.md', '# Hello World');
    assert.ok(safe.valid);
    assert.ok(safe.checksum);

    // .md files: dangerous patterns produce warnings (not errors)
    const mdWithPattern = validateFileContent('test.md', 'eval("alert(1)")');
    assert.ok(mdWithPattern.valid); // .md → still valid
    assert.ok(mdWithPattern.warnings.length > 0);

    // Non-doc files: dangerous patterns produce errors
    const jsWithPattern = validateFileContent('test.js', 'eval("alert(1)")');
    assert.ok(!jsWithPattern.valid);
    assert.ok(jsWithPattern.errors.length > 0);
  });

  it('should re-export tech detection', () => {
    assert.equal(typeof detectTechStack, 'function');
  });

  it('should re-export ResourceLoader', () => {
    assert.equal(typeof ResourceLoader, 'function');
  });

  it('should export initializeCommons', () => {
    assert.equal(typeof initializeCommons, 'function');
  });
});
