import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VERSIONS_PATH = path.resolve(__dirname, '../.versions.json')

/**
 * 讀取目前的版本記錄。
 * @returns {Record<string, object>}
 */
export function readVersions() {
  if (!fs.existsSync(VERSIONS_PATH))
    return {}
  return JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'))
}

/**
 * 將版本記錄寫回磁碟。
 * @param {Record<string, object>} versions
 */
export function writeVersions(versions) {
  const tmp = `${VERSIONS_PATH}.tmp.${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(versions, null, 2)}\n`)
  fs.renameSync(tmp, VERSIONS_PATH)
}

/**
 * 同步成功後更新單一來源的版本。
 * @param {string} sourceName
 * @param {string} sha - Git commit SHA
 */
export function recordSync(sourceName, sha) {
  const versions = readVersions()
  // 來源不存在時建立初始條目（支援 gstack 等新來源）
  if (!versions[sourceName]) {
    versions[sourceName] = { sha: '', date: '', locked: false, type: 'ai' }
  }
  if (versions[sourceName].locked) {
    console.log(
      `來源 "${sourceName}" 已鎖定於 ${versions[sourceName].sha}，跳過更新`,
    )
    return false
  }
  versions[sourceName].sha = sha
  versions[sourceName].date = new Date().toISOString().split('T')[0]
  writeVersions(versions)
  return true
}

/**
 * 檢查來源是否需要同步（SHA 變更或為空）。
 * @param {string} sourceName
 * @param {string} remoteSha - 目前遠端 HEAD SHA
 * @returns {boolean}
 */
export function needsSync(sourceName, remoteSha) {
  const versions = readVersions()
  const entry = versions[sourceName]
  if (!entry)
    return true
  if (entry.locked)
    return false
  if (!entry.sha)
    return true
  return entry.sha !== remoteSha
}

/**
 * 鎖定來源於目前版本。
 * @param {string} sourceName
 */
export function lockSource(sourceName) {
  const versions = readVersions()
  if (!versions[sourceName]) {
    throw new Error(`未知的來源: ${sourceName}`)
  }
  versions[sourceName].locked = true
  writeVersions(versions)
}

/**
 * 解鎖來源以允許同步。
 * @param {string} sourceName
 */
export function unlockSource(sourceName) {
  const versions = readVersions()
  if (!versions[sourceName]) {
    throw new Error(`未知的來源: ${sourceName}`)
  }
  versions[sourceName].locked = false
  writeVersions(versions)
}
