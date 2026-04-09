#!/usr/bin/env bash
set -euo pipefail

# ── 前置檢查 ──
for cmd in node git npx; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ $cmd 未安裝，請先安裝後重試" >&2
    exit 1
  fi
done

if ! npx changeset --help &>/dev/null; then
  echo "❌ @changesets/cli 未安裝，請執行：pnpm add -D @changesets/cli" >&2
  exit 1
fi

if ! git diff --quiet HEAD 2>/dev/null; then
  echo "⚠️ 有未提交的變更，請先 commit 或 stash" >&2
  exit 1
fi

# ── 執行版本發布 ──
changeset version
git add -A
git commit -m 'chore: version packages'

VERSION=$(node -p "require('./package.json').version")
git tag "v${VERSION}"
echo "✔ 已建立 tag v${VERSION}"

git push --follow-tags
echo "✔ 已推送到遠端（含 tag）"
