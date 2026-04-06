import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { detectTechStack } from '../scripts/tech-detection.mjs';

describe('detectTechStack', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-detect-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should detect JavaScript from package.json', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'javascript'));
  });

  it('should detect TypeScript from tsconfig.json', async () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'typescript'));
  });

  it('should detect React from package.json dependencies', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      'utf8',
    );
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'react'));
  });

  it('should detect Python from requirements.txt', async () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.0', 'utf8');
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'python'));
  });

  it('should detect Go from go.mod', async () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/app', 'utf8');
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'go'));
  });

  it('should detect Rust from Cargo.toml', async () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]', 'utf8');
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'rust'));
  });

  it('should detect testing frameworks from devDependencies', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      'utf8',
    );
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.ok(result.technologies.some((t) => t.name === 'testing'));
  });

  it('should return sorted by confidence descending', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18', typescript: '^5' } }),
      'utf8',
    );
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    const result = await detectTechStack({ localPaths: [tmpDir] });
    for (let i = 1; i < result.technologies.length; i++) {
      assert.ok(result.technologies[i - 1].confidence >= result.technologies[i].confidence);
    }
  });

  it('should return empty for directory with no tech signatures', async () => {
    const result = await detectTechStack({ localPaths: [tmpDir] });
    assert.equal(result.technologies.length, 0);
  });
});
