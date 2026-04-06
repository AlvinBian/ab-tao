import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_SIZE = 100 * 1024; // 100KB

const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/gi, label: 'eval()' },
  { pattern: /\bFunction\s*\(/gi, label: 'Function()' },
  { pattern: /\b(?:import|require)\s*\(/gi, label: 'dynamic import/require' },
  { pattern: /\brm\s+-rf\b/gi, label: 'rm -rf' },
  { pattern: /\bsudo\b/gi, label: 'sudo' },
  { pattern: /<!--\s*(?:system|hidden|ignore|secret)/gi, label: 'hidden HTML directive' },
];

const CONTROL_CHAR_REGEX = /[\u200B-\u200D\uFEFF\x00-\x08\x0B-\x0C\x0E-\x1F]/;

/**
 * Validate a single file's content for security threats.
 * @param {string} filePath - File path (for reporting)
 * @param {string} content - File content
 * @returns {{ valid: boolean, errors: object[], warnings: object[], checksum: string }}
 */
export function validateFileContent(filePath, content) {
  const errors = [];
  const warnings = [];

  // 1. File size check
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_FILE_SIZE) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `${bytes} bytes exceeds ${MAX_FILE_SIZE} byte limit`,
      file: filePath,
    });
  }

  // 2. Dangerous pattern scan
  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      errors.push({
        code: 'DANGEROUS_PATTERN',
        message: `Blocked pattern: ${label}`,
        file: filePath,
      });
    }
  }

  // 3. Path traversal check
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    errors.push({
      code: 'PATH_TRAVERSAL',
      message: `Path traversal detected: ${filePath}`,
      file: filePath,
    });
  }

  // 4. Hidden/control character check
  if (CONTROL_CHAR_REGEX.test(content)) {
    warnings.push({
      code: 'SUSPICIOUS_CHARACTERS',
      message: 'File contains hidden or control characters',
      file: filePath,
    });
  }

  // 5. Filename validation (no special chars that could cause issues)
  const basename = path.basename(filePath);
  if (/[<>:"|?*\x00]/.test(basename)) {
    errors.push({
      code: 'INVALID_FILENAME',
      message: `Invalid characters in filename: ${basename}`,
      file: filePath,
    });
  }

  const checksum = crypto.createHash('sha256').update(content).digest('hex');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checksum,
  };
}

/**
 * Sanitize content by removing zero-width and control characters.
 * @param {string} content
 * @returns {string}
 */
export function sanitizeContent(content) {
  return content
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
}

/**
 * Validate all .md files in a resource directory.
 * @param {string} resourcePath - Root path of the resource
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
  };

  if (!fs.existsSync(resourcePath)) {
    summary.errors.push({
      code: 'DIR_NOT_FOUND',
      message: `Directory not found: ${resourcePath}`,
      file: resourcePath,
    });
    return summary;
  }

  const walkDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden dirs and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath);
        }
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const relativePath = path.relative(resourcePath, fullPath);
        const result = validateFileContent(relativePath, content);

        summary.total++;
        if (result.valid) {
          summary.valid++;
        } else {
          summary.invalid++;
        }
        summary.errors.push(...result.errors);
        summary.warnings.push(...result.warnings);
        summary.checksums[relativePath] = result.checksum;
      }
    }
  };

  walkDir(resourcePath);
  return summary;
}

/**
 * Validate resource content after sync — main entry point.
 * @param {string} resourcePath
 * @returns {{ ok: boolean, summary: object }}
 */
export async function validateContent(resourcePath) {
  const summary = validateDirectory(resourcePath);
  const ok = summary.invalid === 0;

  if (!ok) {
    console.error(`Security validation failed: ${summary.invalid}/${summary.total} files have issues`);
    for (const err of summary.errors) {
      console.error(`  [${err.code}] ${err.file}: ${err.message}`);
    }
  }

  if (summary.warnings.length > 0) {
    for (const warn of summary.warnings) {
      console.warn(`  [${warn.code}] ${warn.file}: ${warn.message}`);
    }
  }

  return { ok, summary };
}
