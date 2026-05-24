import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const MAX_FILE_SIZE = 512 * 1024 // 512KB

const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/gi, label: 'eval()' },
  { pattern: /\bFunction\s*\(/gi, label: 'Function()' },
  { pattern: /\b(?:import|require)\s*\(/gi, label: 'dynamic import/require' },
  { pattern: /\brm\s+-rf\b/gi, label: 'rm -rf' },
  { pattern: /\bsudo\b/gi, label: 'sudo' },
  {
    pattern: /<!--\s*(?:system|hidden|ignore|secret)/gi,
    label: 'hidden HTML directive',
  },
]

// eslint-disable-next-line no-control-regex -- 刻意偵測零寬度與控制字元
const CONTROL_CHAR_REGEX = /[\u200B-\u200D\uFEFF\x00-\x08\v\f\x0E-\x1F]/

/**
 * 判斷檔案是否為文件類型（.md 等），其中危險 pattern 屬於說明文字。
 */
function isDocumentationFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ['.md', '.mdx', '.txt', '.rst'].includes(ext)
}

/**
 * 判斷檔案是否為已知的 hooks 配置檔，其中 require() 是合法的 inline script。
 */
function isHooksConfigFile(filePath) {
  const basename = path.basename(filePath)
  return basename === 'hooks.json'
}

/**
 * 驗證單一檔案的內容安全性。
 *
 * 對文件檔 (.md)，危險 pattern 產生警告（非錯誤），
 * 因為文件中常以說明方式提及這些 pattern。
 *
 * @param {string} filePath - 檔案路徑（用於報告）
 * @param {string} content - 檔案內容
 * @param {{ strict?: boolean }} options - 選項。strict=true 強制對文件檔也產生錯誤。
 * @returns {{ valid: boolean, errors: object[], warnings: object[], checksum: string }}
 */
export function validateFileContent(filePath, content, options = {}) {
  const errors = []
  const warnings = []
  const isDoc = !options.strict && isDocumentationFile(filePath)
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_FILE_SIZE) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `${bytes} bytes 超過 ${MAX_FILE_SIZE} byte 限制`,
      file: filePath,
    })
  }

  // 2. 危險 pattern 掃描
  // 文件檔：pattern 為警告（說明文字）
  // hooks.json：dynamic import/require 為合法 inline script，跳過該 pattern
  // 可執行檔（.sh, .js）：pattern 為錯誤
  const isHooks = isHooksConfigFile(filePath)
  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    // hooks.json 裡的 require() 是合法的，跳過
    if (isHooks && label === 'dynamic import/require')
      continue

    // 重設 lastIndex（全域正則）
    pattern.lastIndex = 0
    if (pattern.test(content)) {
      const entry = {
        code: 'DANGEROUS_PATTERN',
        message: `${isDoc ? '發現 pattern' : '攔截 pattern'}: ${label}`,
        file: filePath,
      }
      if (isDoc) {
        warnings.push(entry)
      }
      else {
        errors.push(entry)
      }
    }
  }

  // 3. 路徑遍歷檢查
  const normalized = path.normalize(filePath)
  if (normalized.includes('..')) {
    errors.push({
      code: 'PATH_TRAVERSAL',
      message: `偵測到路徑遍歷: ${filePath}`,
      file: filePath,
    })
  }

  // 4. 隱藏/控制字元檢查
  if (CONTROL_CHAR_REGEX.test(content)) {
    warnings.push({
      code: 'SUSPICIOUS_CHARACTERS',
      message: '檔案包含隱藏或控制字元',
      file: filePath,
    })
  }

  // 5. 檔名驗證（不允許可能導致問題的特殊字元）
  const basename = path.basename(filePath)
  if (/[<>:"|?*\0]/.test(basename)) {
    errors.push({
      code: 'INVALID_FILENAME',
      message: `檔名包含無效字元: ${basename}`,
      file: filePath,
    })
  }

  const checksum = crypto.createHash('sha256').update(content).digest('hex')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checksum,
  }
}

/**
 * 清理內容：移除零寬度字元與控制字元。
 * @param {string} content
 * @returns {string}
 */
export function sanitizeContent(content) {
  return (
    content
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // eslint-disable-next-line no-control-regex -- 刻意移除控制字元
      .replace(/[\x00-\x08\v\f\x0E-\x1F]/g, '')
  )
}

/**
 * 驗證資源目錄中所有 .md 與 .json 檔案。
 * @param {string} resourcePath - 資源根目錄路徑
 * @returns {{ total: number, valid: number, invalid: number, errors: object[], warnings: object[], checksums: Record<string, string> }}
 */
export function validateDirectory(resourcePath) {
  const summary = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    warnings: [],
    checksums: {},
  }

  if (!fs.existsSync(resourcePath)) {
    summary.errors.push({
      code: 'DIR_NOT_FOUND',
      message: `目錄不存在: ${resourcePath}`,
      file: resourcePath,
    })
    return summary
  }

  const walkDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      // 偵測 broken symlink（isDirectory/isFile 皆回 false，只有 isSymbolicLink 為 true）
      if (entry.isSymbolicLink()) {
        try {
          fs.statSync(fullPath) // 跟隨 symlink；broken 時丟 ENOENT
        }
        catch {
          const relPath = path.relative(resourcePath, fullPath)
          summary.warnings.push({
            code: 'BROKEN_SYMLINK',
            message: `broken symlink，cpSync 時會失敗（target 不存在）`,
            file: relPath,
          })
          continue
        }
      }
      if (entry.isDirectory()) {
        // 跳過隱藏目錄與 node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath)
        }
      }
      else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
        // 跳過 broken symlink 或不可讀檔案（雙重保護）
        if (!fs.existsSync(fullPath))
          continue
        const content = fs.readFileSync(fullPath, 'utf8')
        const relativePath = path.relative(resourcePath, fullPath)
        const result = validateFileContent(relativePath, content)

        summary.total++
        if (result.valid) {
          summary.valid++
        }
        else {
          summary.invalid++
        }
        summary.errors.push(...result.errors)
        summary.warnings.push(...result.warnings)
        summary.checksums[relativePath] = result.checksum
      }
    }
  }

  walkDir(resourcePath)
  return summary
}

/**
 * 驗證同步後的資源內容 — 主入口。
 * @param {string} resourcePath
 * @returns {{ ok: boolean, summary: object }}
 */
export async function validateContent(resourcePath) {
  const summary = validateDirectory(resourcePath)
  const ok = summary.invalid === 0

  if (!ok) {
    console.error(
      `安全驗證失敗: ${summary.invalid}/${summary.total} 個檔案有問題`,
    )
    for (const err of summary.errors) {
      console.error(`  [${err.code}] ${err.file}: ${err.message}`)
    }
  }

  if (summary.warnings.length > 0) {
    for (const warn of summary.warnings) {
      console.warn(`  [${warn.code}] ${warn.file}: ${warn.message}`)
    }
  }

  return { ok, summary }
}
