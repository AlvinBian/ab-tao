/**
 * Plugins Feature — 官方 Claude Plugins 安裝
 *
 * 獨立管理官方推薦 Plugins 的偵測、選擇與安裝。
 * 不依賴任何其他 feature，直接呼叫 claude plugin CLI。
 */

import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'

import * as p from '@clack/prompts'
import { isEmpty } from 'lodash-es'
import { BACK, handleCancel, multiselectWithPrefs } from '../cli/prompts.mjs'
import { getCliBin } from '../external/claude-cli.mjs'

const execFileAsync = promisify(execFile)

/** 官方推薦 Plugins */
const RECOMMENDED_PLUGINS = [
  { name: 'code-review', desc: '多 agent 並行 PR 審查' },
  { name: 'security-guidance', desc: '安全漏洞掃描與修復建議' },
  { name: 'hookify', desc: '分析對話模式自動生成 hooks' },
  { name: 'ralph-loop', desc: '持續迭代迴圈 — 自動重試直到完成' },
  { name: 'session-report', desc: 'Session 分析報告 — 回顧工作成果' },
]

/** 偵測已安裝的 plugins（快取結果避免重複呼叫 CLI） */
let _installedCache
function getInstalledPlugins() {
  if (_installedCache !== undefined)
    return _installedCache
  try {
    const bin = getCliBin()
    if (!bin) {
      _installedCache = null
      return null
    }
    const out = execFileSync(bin, ['plugin', 'list', '--json'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    })
    _installedCache = new Set(
      JSON.parse(out.toString()).map(
        pl => (pl.id ?? pl.name ?? '').split('@')[0],
      ),
    )
  }
  catch {
    _installedCache = null
  }
  return _installedCache
}

/** 官方 Plugins marketplace 來源 */
const MARKETPLACE_REPO = 'anthropics/claude-plugins-official'

export default {
  id: 'plugins',
  label: '🔌 官方 Plugins',
  hint: 'code-review · security-guidance · hookify · ralph-loop · session-report',
  dependsOn: [],
  conflicts: [],

  /**
   * 1. 環境檢查（驗證 claude CLI 可用）
   */
  async envCheck() {
    const installed = getInstalledPlugins()
    if (installed === null) {
      return {
        ok: false,
        message: '🔌 Claude CLI 不可用',
      }
    }
    return {
      ok: true,
      message: `🔌 Claude CLI ✔（已安裝 ${installed.size} 個 plugin）`,
    }
  },

  /**
   * 2. 備份（plugins 無需備份）
   */
  async backup() {
    return { files: [], dir: '' }
  },

  /**
   * 3. 互動配置（選擇要安裝的 plugins）
   */
  async configure(ctx) {
    const installed = getInstalledPlugins()
    if (!installed)
      return null

    const missing = RECOMMENDED_PLUGINS.filter(pl => !installed.has(pl.name))
    if (isEmpty(missing)) {
      p.log.info('所有推薦 Plugins 已安裝 ✔')
      return null
    }

    if (ctx.flags?.quick) {
      // Quick 模式：重裝上次安裝的 plugins
      const prevPlugins = ctx.prev?.install?.plugins
      if (prevPlugins?.length)
        return { plugins: prevPlugins }
      return null // 上次沒裝 plugins
    }

    if (ctx.flags?.all) {
      return { plugins: missing.map(pl => pl.name) }
    }

    const pluginOptions = missing.map(pl => ({
      value: pl.name,
      label: pl.desc ? `${pl.name} ${pl.desc}` : pl.name,
    }))
    const selected = handleCancel(
      await multiselectWithPrefs(
        'plugins.list',
        pluginOptions,
        ({ options: sortedOpts, initialValues }) =>
          p.multiselect({
            message: `推薦 Plugins（${missing.length} 個未安裝）`,
            options: sortedOpts,
            // 首次（無偏好）預勾全部 missing；有偏好時以偏好排序為準
            initialValues: initialValues.length ? initialValues : pluginOptions.map(o => o.value),
            required: false,
          }),
      ),
    )

    if (selected === BACK || isEmpty(selected))
      return null
    return { plugins: selected }
  },

  /**
   * 4. 生成計畫
   */
  async plan(_ctx, config) {
    if (!config)
      return null
    return {
      plugins: config.plugins,
      features: ['plugins'],
      targets: ['plugins'],
    }
  },

  /**
   * 5. 確認
   */
  async confirm(ctx, plan) {
    if (!plan)
      return false
    if (ctx.flags?.all || ctx.flags?.quick)
      return true

    p.log.info(
      `將安裝 ${plan.plugins.length} 個 Plugins：${plan.plugins.join('、')}`,
    )

    return (
      handleCancel(
        await p.confirm({ message: '確認安裝？', initialValue: true }),
      ) === true
    )
  },

  /**
   * 6. 安裝（加入 marketplace → 逐一安裝 plugins）
   */
  async install(_ctx, plan) {
    if (!plan?.plugins?.length)
      return null

    const bin = getCliBin()
    if (!bin) {
      p.log.warn('Claude CLI 不可用，略過 plugins 安裝')
      return null
    }

    const s = p.spinner()

    // 確保 marketplace 已加入
    s.start('確認 marketplace...')
    try {
      const { stdout } = await execFileAsync(
        bin,
        ['plugin', 'marketplace', 'list', '--json'],
        { timeout: 10000 },
      )
      const list = JSON.parse(stdout)
      if (!list.some(m => m.repo === MARKETPLACE_REPO)) {
        s.message('加入 marketplace...')
        await execFileAsync(
          bin,
          ['plugin', 'marketplace', 'add', MARKETPLACE_REPO],
          { timeout: 120000 },
        )
      }
    }
    catch {
      s.message('marketplace 加入失敗，嘗試直接安裝...')
    }

    const installed = []
    const failed = []
    for (let i = 0; i < plan.plugins.length; i++) {
      const name = plan.plugins[i]
      s.message(`[${i + 1}/${plan.plugins.length}] 安裝 ${name}...`)
      try {
        await execFileAsync(
          bin,
          ['plugin', 'install', `${name}@claude-plugins-official`],
          { timeout: 60000 },
        )
        installed.push(name)
      }
      catch {
        failed.push(name)
      }
    }

    s.stop(`已安裝 ${installed.length}/${plan.plugins.length} 個 plugins`)

    return { plugins: installed, pluginsFailed: failed }
  },

  /**
   * 7. 驗證（檢查推薦 plugins 安裝狀態）
   */
  async verify() {
    _installedCache = undefined // 重置快取，取得安裝後最新狀態
    const installed = getInstalledPlugins()
    if (!installed)
      return { passed: 0, total: 0, missing: [] }

    const missing = RECOMMENDED_PLUGINS.filter(
      pl => !installed.has(pl.name),
    ).map(pl => pl.name)

    return {
      passed: RECOMMENDED_PLUGINS.length - missing.length,
      total: RECOMMENDED_PLUGINS.length,
      missing,
    }
  },

  /**
   * 8. 完成輸出
   */
  complete(results) {
    const lines = ['🔌 官方 Plugins']
    const installed = getInstalledPlugins()
    const installedRec = installed
      ? RECOMMENDED_PLUGINS.filter(pl => installed.has(pl.name))
      : []

    if (!results) {
      // configure() 略過 — 顯示目前已安裝清單
      if (installedRec.length) {
        lines.push(
          `  ✔ 已安裝：${installedRec.map(pl => pl.name).join('、')}`,
        )
      }
      return lines
    }
    if (results.plugins?.length)
      lines.push(`  ✔ 已安裝：${results.plugins.join('、')}`)
    if (results.pluginsFailed?.length)
      lines.push(`  ✘ 失敗：${results.pluginsFailed.join('、')}`)
    return lines
  },

  /**
   * 9. 回滾（plugins 透過 CLI 管理，無需回滾檔案）
   */
  async rollback() {},

  /**
   * 10. Session 數據
   */
  session(results) {
    return {
      plugins: results?.plugins || [],
      pluginsFailed: results?.pluginsFailed || [],
    }
  },

  /**
   * 11. 清理
   */
  async cleanup() {},

  /**
   * 12. 報告數據
   */
  report(results) {
    return { feature: 'plugins', ...results }
  },
}
