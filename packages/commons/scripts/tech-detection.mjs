import fs from 'node:fs';
import path from 'node:path';

const TECH_SIGNATURES = {
  typescript: ['tsconfig.json', 'tsconfig.*.json'],
  javascript: ['package.json', 'jsconfig.json'],
  react: ['package.json'],
  vue: ['package.json', 'vue.config.js', 'nuxt.config.ts'],
  python: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
  go: ['go.mod', 'go.sum'],
  rust: ['Cargo.toml'],
  testing: [],
};

const PACKAGE_TECH_MAP = {
  react: 'react',
  'react-dom': 'react',
  vue: 'vue',
  nuxt: 'vue',
  jest: 'testing',
  vitest: 'testing',
  mocha: 'testing',
  typescript: 'typescript',
};

/**
 * Detect tech stack from file system signatures.
 * @param {{ githubRepos?: string[], localPaths?: string[] }} context
 * @returns {Promise<{ technologies: { name: string, confidence: number }[] }>}
 */
export async function detectTechStack(context = {}) {
  const localPaths = context.localPaths || ['.'];
  const detected = new Map();

  for (const basePath of localPaths) {
    // File-based detection
    for (const [tech, files] of Object.entries(TECH_SIGNATURES)) {
      for (const file of files) {
        const checkPath = path.join(basePath, file);
        if (fs.existsSync(checkPath)) {
          const current = detected.get(tech) || 0;
          detected.set(tech, Math.min(current + 0.3, 1.0));
        }
      }
    }

    // package.json dependency detection
    const pkgPath = path.join(basePath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        for (const [dep, tech] of Object.entries(PACKAGE_TECH_MAP)) {
          if (allDeps[dep]) {
            const current = detected.get(tech) || 0;
            detected.set(tech, Math.min(current + 0.5, 1.0));
          }
        }

        // Always mark javascript if package.json exists
        const jsConf = detected.get('javascript') || 0;
        detected.set('javascript', Math.min(jsConf + 0.5, 1.0));
      } catch {
        // Ignore malformed package.json
      }
    }
  }

  const technologies = Array.from(detected.entries())
    .map(([name, confidence]) => ({ name, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  return { technologies };
}
