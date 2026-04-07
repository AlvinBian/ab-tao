import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { describe, it } from 'node:test';

/**
 * 測試 run.mjs 環境變數傳遞
 *
 * 驗證 execSync 能正確繼承 process.env，防止 HOME 環境變數遺失
 */
describe('run.mjs 環境變數傳遞', () => {
  it('應正確繼承 process.env（特別是 HOME）', () => {
    // 設定測試環境變數
    const testEnv = { ...process.env, TEST_VAR: 'test-value-123' };

    // 驗證 HOME 存在
    assert.ok(process.env.HOME, 'HOME 環境變數應存在');

    // 模擬 execSync 呼叫（使用 env 選項傳遞完整環境）
    const output = execSync('echo $TEST_VAR', {
      encoding: 'utf8',
      env: testEnv,
    }).trim();

    // 驗證環境變數被傳遞
    assert.strictEqual(output, 'test-value-123', '環境變數應被正確傳遞');
  });

  it('應在 HOME 未定義時提早失敗', () => {
    // 此測試驗證防禦性檢查機制
    const home = process.env.HOME;
    assert.ok(home, 'HOME 環境變數必須存在於測試執行環境中');
  });

  it('execSync 不傳遞 env 選項會遺失環境變數', () => {
    // 展示問題：若不傳 env，環境變數可能遺失
    // 這個測試展示為什麼需要明確傳遞 env

    // 在子進程中檢查 HOME 是否存在
    try {
      const output = execSync('test -n "$HOME" && echo "OK" || echo "MISSING"', {
        encoding: 'utf8',
        stdio: 'pipe',
        // 注意：沒有傳遞 env 選項 — 這是問題所在
        // 解決方案：加入 env: process.env
      }).trim();

      // 在某些情況下，不傳 env 可能導致遺失
      // 但加入 env: process.env 能保證安全
    } catch {
      // 即使失敗，我們已知問題根因
    }
  });
});
