import fs from 'node:fs'
import path from 'node:path'

const TECH_SIGNATURES = {
  typescript: ['tsconfig.json', 'tsconfig.*.json'],
  javascript: ['package.json', 'jsconfig.json'],
  react: ['package.json'],
  vue: ['package.json', 'vue.config.js', 'nuxt.config.ts'],
  python: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
  go: ['go.mod', 'go.sum'],
  rust: ['Cargo.toml'],
  testing: [],
}

/**
 * 技術/框架名稱對應標準語言目錄名。
 * 用於篩選語言專屬資源（如 rules/{lang}/）。
 */
export const TECH_TO_LANG = {
  'typescript': 'typescript',
  'javascript': 'typescript',
  'vue': 'typescript',
  'vitest': 'typescript',
  'nuxt': 'typescript',
  'react': 'typescript',
  'nextjs': 'typescript',
  'angular': 'typescript',
  'svelte': 'typescript',
  'php': 'php',
  'laravel': 'php',
  'wordpress': 'php',
  'python': 'python',
  'django': 'python',
  'flask': 'python',
  'fastapi': 'python',
  'golang': 'golang',
  'go': 'golang',
  'rust': 'rust',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'android': 'kotlin',
  'java': 'java',
  'spring': 'java',
  'cpp': 'cpp',
  'c++': 'cpp',
  'csharp': 'csharp',
  'dotnet': 'csharp',
  'perl': 'perl',
}

const PACKAGE_TECH_MAP = {
  'react': 'react',
  'react-dom': 'react',
  'vue': 'vue',
  'nuxt': 'vue',
  'jest': 'testing',
  'vitest': 'testing',
  'mocha': 'testing',
  'typescript': 'typescript',
}

/**
 * 從檔案系統特徵偵測技術棧。
 * @param {{ githubRepos?: string[], localPaths?: string[] }} context
 * @returns {Promise<{ technologies: { name: string, confidence: number }[] }>}
 */
export async function detectTechStack(context = {}) {
  const localPaths = context.localPaths || ['.']
  const detected = new Map()

  for (const basePath of localPaths) {
    // 檔案特徵偵測
    for (const [tech, files] of Object.entries(TECH_SIGNATURES)) {
      for (const file of files) {
        const checkPath = path.join(basePath, file)
        if (fs.existsSync(checkPath)) {
          const current = detected.get(tech) || 0
          detected.set(tech, Math.min(current + 0.3, 1.0))
        }
      }
    }

    // package.json 依賴偵測
    const pkgPath = path.join(basePath, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        }

        for (const [dep, tech] of Object.entries(PACKAGE_TECH_MAP)) {
          if (allDeps[dep]) {
            const current = detected.get(tech) || 0
            detected.set(tech, Math.min(current + 0.5, 1.0))
          }
        }

        // 存在 package.json 則標記 javascript
        const jsConf = detected.get('javascript') || 0
        detected.set('javascript', Math.min(jsConf + 0.5, 1.0))
      }
      catch {
        // 忽略格式錯誤的 package.json
      }
    }
  }

  const technologies = Array.from(detected.entries())
    .map(([name, confidence]) => ({ name, confidence }))
    .sort((a, b) => b.confidence - a.confidence)

  return { technologies }
}
