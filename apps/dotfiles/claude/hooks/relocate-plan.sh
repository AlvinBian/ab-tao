#!/usr/bin/env bash
# relocate-plan.sh — SessionEnd/Stop hook：自動將新 plan 歸位至 per-project 目錄
#
# 偵測 ~/.claude/plans/ 中未被追蹤的 .md 檔，依當前 CWD 移至
# ~/.claude/projects/{encoded}/plans/{slug}.md，並更新 index.md。
#
# 冪等：~/.claude/.plans-relocated 紀錄已歸位的 slug，重跑不重複搬。

command -v jq &>/dev/null || exit 0

HOME_DIR="$HOME"
PLANS_DIR="$HOME_DIR/.claude/plans"
PROJECTS_DIR="$HOME_DIR/.claude/projects"
RELOCATED_MARKER="$HOME_DIR/.claude/.plans-relocated"

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

[ -z "$CWD" ] && exit 0
[ ! -d "$PLANS_DIR" ] && exit 0

# 確認 CWD 是真實 git repo（避免 hook 在非專案目錄觸發）
[ ! -d "$CWD/.git" ] && exit 0

# 將 CWD 編碼為 projects/ 的子目錄名稱（/ → -）
ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
TARGET_PLANS_DIR="$PROJECTS_DIR/$ENCODED/plans"

# 讀取已遷移記錄
relocated_slugs=""
[ -f "$RELOCATED_MARKER" ] && relocated_slugs=$(cat "$RELOCATED_MARKER")

# 掃描 ~/.claude/plans/*.md（排除 README.md）
found=0
for plan_file in "$PLANS_DIR"/*.md; do
	[ -f "$plan_file" ] || continue
	slug=$(basename "$plan_file")
	[ "$slug" = "README.md" ] && continue

	# 已追蹤則跳過（冪等）
	if printf '%s\n' "$relocated_slugs" | grep -qxF "$slug"; then
		continue
	fi

	# 建立目標目錄
	mkdir -p "$TARGET_PLANS_DIR"

	# 複製並刪除原檔（原子性不強，但在同 fs 上 cp+rm 夠用）
	if cp "$plan_file" "$TARGET_PLANS_DIR/$slug" 2>/dev/null; then
		rm -f "$plan_file"

		# 更新 index.md（append 一行連結）
		index_file="$TARGET_PLANS_DIR/index.md"
		entry="- [$slug](./$slug)"
		if [ ! -f "$index_file" ]; then
			printf '# Plans\n\n%s\n' "$entry" > "$index_file"
		elif ! grep -qF "./$slug" "$index_file" 2>/dev/null; then
			printf '\n%s\n' "$entry" >> "$index_file"
		fi

		# 記錄已遷移
		printf '%s\n' "$slug" >> "$RELOCATED_MARKER"
		relocated_slugs="$relocated_slugs
$slug"

		found=$((found + 1))
		printf '[relocate-plan] %s → %s\n' "$slug" "$TARGET_PLANS_DIR" >&2
	fi
done

exit 0
