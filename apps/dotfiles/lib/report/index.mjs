/**
 * 報告模組入口
 *
 * 職責：重新匯出所有公共 API，提供向後相容性。
 * 舊匯入方式 `from '../report.mjs'` 改為 `from '../report/index.mjs'`
 * （或直接 `from '../report/'` 自動解析 index.mjs）
 */

export {
  badge,
  badgeWithDesc,
  esc,
  estimateTokenSize,
  getStyles,
  renderBackup,
  renderClaudeIgnoreStats,
  renderCleanup,
  renderEcc,
  renderInstalled,
  renderOverview,
  renderPlugins,
  renderStacks,
  renderTokenChart,
  section,
} from './formatters.mjs';
export {
  generateReport,
  openInBrowser,
  saveReport,
} from './renderer.mjs';
