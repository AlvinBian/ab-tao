#!/bin/bash
# PR 合入前自動驗證腳本
set -e

cd "$(dirname "$0")/.."
echo "=== ab-tao Verification ==="

# 1. JSON 合法性
echo ""
echo "--- JSON Validation ---"
node -e "JSON.parse(require('fs').readFileSync('config.json'))" && echo "✓ config.json"
node -e "JSON.parse(require('fs').readFileSync('claude/hooks.json'))" && echo "✓ hooks.json"

# 2. YAML frontmatter 檢查
echo ""
echo "--- Frontmatter Check ---"
MISSING=0
for f in claude/agents/*.md claude/commands/*.md claude/rules/*.md; do
  if ! head -1 "$f" | grep -q '^---$'; then
    echo "✗ $f missing frontmatter"
    MISSING=$((MISSING + 1))
  fi
done
if [ $MISSING -eq 0 ]; then
  echo "✓ All .md files have frontmatter"
fi

# 3. Frontmatter 路由檢查（matchWhen 或 paths 或 disable-model-invocation）
echo ""
echo "--- Routing Check ---"
MW_MISSING=0
for f in claude/agents/*.md claude/commands/*.md claude/rules/*.md; do
  if ! grep -qE "matchWhen|^paths:|disable-model-invocation" "$f" 2>/dev/null; then
    echo "✗ $(basename $f) missing routing config"
    MW_MISSING=$((MW_MISSING + 1))
  fi
done
if [ $MW_MISSING -eq 0 ]; then
  echo "✓ All .md files have routing config"
fi

# 4. Module import 驗證
echo ""
echo "--- Module Import Check ---"
node -e "
const modules = [
  './libs/cli/prompts.mjs',
  './libs/cli/progress.mjs',
  './libs/cli/files.mjs',
  './libs/cli/task-runner.mjs',
  './libs/install/index.mjs',
  './libs/install/common.mjs',
  './libs/core/paths.mjs',
  './libs/core/concurrency.mjs',
  './libs/core/session.mjs',
  './libs/detect/repo-select.mjs',
  './libs/phases/phase-analyze.mjs',
  './libs/phases/phase-plan.mjs',
  './libs/phases/phase-execute.mjs',
  './libs/phases/phase-complete.mjs',
  './libs/config/auto-plan.mjs',
  './libs/config/config-classifier.mjs',
  './libs/detect/repo-detect.mjs',
  './libs/install/config-sync.mjs',
  './libs/config/preserve-policy.mjs',
  './libs/config/upgrade.mjs',
]
Promise.all(modules.map(m => import(m).then(() => '✓ ' + m).catch(e => '✗ ' + m + ': ' + e.message)))
  .then(results => {
    results.forEach(r => console.log(r))
    const fails = results.filter(r => r.startsWith('✗'))
    if (fails.length > 0) process.exit(1)
  })
"

# 5. v2 Templates Check
echo ""
echo "--- v2 Template Check ---"
node -e "JSON.parse(require('fs').readFileSync('claude/settings.template.json'))" && echo "✓ settings.template.json"

# 6. 檔案統計
echo ""
echo "--- File Stats ---"
AGENTS=$(ls claude/agents/*.md 2>/dev/null | wc -l | tr -d ' ')
COMMANDS=$(ls claude/commands/*.md 2>/dev/null | wc -l | tr -d ' ')
RULES=$(ls claude/rules/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Agents: $AGENTS | Commands: $COMMANDS | Rules: $RULES"

# 7. 無殘留舊路徑
echo ""
echo "--- Old Import Check ---"
OLD_IMPORTS=$(grep -rn "from.*['\"]\.\.*/ui\.mjs['\"]" lib/ bin/ 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
OLD_IH=$(grep -rn "from.*install-handlers" lib/ bin/ 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
OLD_PHASES=$(grep -rn "phase-intent\|phase-analysis\|phase-report" lib/ bin/ 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
if [ "$OLD_IMPORTS" -eq 0 ] && [ "$OLD_IH" -eq 0 ] && [ "$OLD_PHASES" -eq 0 ]; then
  echo "✓ No legacy import paths found"
else
  echo "✗ Found $OLD_IMPORTS ui.mjs refs + $OLD_IH install-handlers refs + $OLD_PHASES old phase refs"
fi

echo ""
echo "=== Verification Complete ==="
