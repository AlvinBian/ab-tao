import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    vue: true,
    typescript: true,
    // Markdown 內的 code block 常含示例程式碼（非合法 JS），關閉 markdown lint
    markdown: false,
    ignores: [
      '**/*.yml',
      '**/*.yaml',
      '**/resources/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.cache/**',
      // 這些 Markdown 文件含 code block 示例，不是真實 JS
      '**/*.md',
      'apps/console/src/auto-imports.d.ts',
      'apps/console/src/components.d.ts',
    ],
  },
  // Node.js ESM 腳本（dotfiles / commons / share / console server + build config）
  // 全域 process / Buffer 在 Node.js ESM 是合法用法
  {
    files: [
      'apps/dotfiles/**/*.mjs',
      'apps/console/**/*.mjs',
      'apps/console/**/*.ts',
      'packages/**/*.mjs',
      'scripts/**/*.mjs',
    ],
    rules: {
      'no-console': 'off',
      'antfu/no-top-level-await': 'off',
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },
  // CLI / 工具庫採 Node.js 內建 test runner（node --test，零依賴，見 rules/testing.md），
  // 非 vitest；關閉 antfu 預設「強制從 vitest import」規則。console 走 vitest，不在此範圍。
  {
    files: [
      'apps/dotfiles/**/__tests__/**/*.mjs',
      'packages/commons/**/__tests__/**/*.mjs',
      'packages/share/**/__tests__/**/*.mjs',
    ],
    rules: {
      'test/no-import-node-test': 'off',
    },
  },
  // dotfiles 特定規則：含 ANSI escape 的 regex 是合法的
  {
    files: ['apps/dotfiles/**/*.mjs', 'apps/dotfiles/**/*.js'],
    rules: {
      'no-control-regex': 'off',
    },
  },
  // 全域規則調整
  {
    rules: {
      // JSDoc 只在有明確描述時檢查，不強制一定要有 @returns description
      'jsdoc/require-returns-description': 'off',
      'jsdoc/check-param-names': 'warn',
      // Regex 規則：效能警告降為 warn；非捕獲群組僅 warn（style 改善，非 bug）
      'regexp/no-super-linear-backtracking': 'warn',
      'regexp/no-obscure-range': 'warn',
      'regexp/no-unused-capturing-group': 'warn',
      'regexp/optimal-quantifier-concatenation': 'warn',
      // _前綴變數視為有意不用，不報 error
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
)
