#!/usr/bin/env bash
# config-lint.sh — SessionStart 配置健檢（agnix-lite）
# 偵測「文件寫了但不存在/不生效」的靜默失效（11 條規則），warn-only 不阻斷（永遠 exit 0）。
# 7 天節流：marker ~/.claude/.ab-tao/config-lint-last-run 存 epoch，--force 繞過節流。
# 用法：config-lint.sh [--force] [--target-root <path>]（預設 $HOME/.claude）

TARGET_ROOT="$HOME/.claude"
FORCE=false

# UTF-8 locale 偵測：R7 的字元數計算必須在 UTF-8 locale 下做。
# 2026-08-13 修：原用 ${#desc}，但 hook 在 LC_CTYPE=C 環境執行時，bash 對多位元組
# UTF-8 算的是 bytes 而非字元（實測「產出 / 改動 .xlsx / 試算表」→ C:33 / UTF-8:19），
# 使「50–200 字元」的門檻對中文 description 實際只剩約 1/1.7。
UTF8_LOCALE=$(locale -a 2>/dev/null | grep -ixE 'en_US\.UTF-?8|C\.UTF-?8' | head -1)
: "${UTF8_LOCALE:=en_US.UTF-8}"

while [ $# -gt 0 ]; do
	case "$1" in
	--force)
		FORCE=true
		shift
		;;
	--target-root)
		TARGET_ROOT="${2:-$TARGET_ROOT}"
		shift 2
		;;
	*)
		shift
		;;
	esac
done

# ── 節流：7 天內已跑過就跳過（--force 繞過）───────────────────────
MARKER="$HOME/.claude/.ab-tao/config-lint-last-run"
NOW=$(date +%s)
if [ "$FORCE" != true ] && [ -f "$MARKER" ]; then
	LAST=$(cat "$MARKER" 2>/dev/null || echo 0)
	[[ "$LAST" =~ ^[0-9]+$ ]] || LAST=0
	if [ $(( NOW - LAST )) -lt $(( 7 * 86400 )) ]; then
		exit 0
	fi
fi

command -v jq &>/dev/null || {
	echo "[config-lint] jq 未安裝，略過健檢"
	exit 0
}

mkdir -p "$(dirname "$MARKER")" 2>/dev/null
printf '%s' "$NOW" > "$MARKER" 2>/dev/null

FINDINGS=()

_add_finding() {
	FINDINGS+=("[$1] $2")
}

# ── R1: claude-md 行數 vs README.md 上限表 ──────────────────────────
_r1() {
	local readme="$TARGET_ROOT/claude-md/README.md"
	[ -f "$readme" ] || return
	local fname desc limit target actual
	while IFS='|' read -r _ fname desc limit _; do
		fname=$(printf '%s' "$fname" | xargs 2>/dev/null)
		limit=$(printf '%s' "$limit" | xargs 2>/dev/null)
		[[ "$fname" == *.md ]] || continue
		[[ "$limit" =~ ^[0-9]+$ ]] || continue
		target="$TARGET_ROOT/claude-md/$fname"
		[ -f "$target" ] || continue
		actual=$(wc -l < "$target" 2>/dev/null | xargs)
		[[ "$actual" =~ ^[0-9]+$ ]] || continue
		if [ "$actual" -gt "$limit" ]; then
			_add_finding "R1" "claude-md/$fname 行數 $actual 超過 README 宣告上限 $limit"
		fi
	done < <(grep '^|' "$readme" 2>/dev/null)
}

# ── R2: claude-md/*.md、docs/*.md 引用的檔案路徑存在性 ───────────────
# 抽取 ~/.claude/...、hooks/...、scripts/...、docs/... 形式的路徑引用
# （charset 限定 [A-Za-z0-9_./-]，天然排除 URL query/@scope 與含 <> {} 的範例佔位）
_r2() {
	# 2026-08-13 補頂層 CLAUDE.md：`rules/confluence.md` 與 `rules/excel-ooxml.md`
	# 沒有 paths: frontmatter，**唯一**載入途徑就是 CLAUDE.md「參考資源」段的指標行。
	# 原本 R2 只掃 claude-md/ 與 docs/，看不到 CLAUDE.md —— 指標行一旦遺失（例如
	# d:setup 用舊 template 覆蓋），那兩個規則檔會靜默失效，而唯一該抓到的規則掃不到。
	local files=("$TARGET_ROOT"/CLAUDE.md "$TARGET_ROOT"/claude-md/*.md "$TARGET_ROOT"/docs/*.md)
	local f raw rel target
	for f in "${files[@]}"; do
		[ -f "$f" ] || continue
		while IFS= read -r raw; do
			[ -z "$raw" ] && continue
			raw="${raw%.}" # 去除句尾誤黏的英文句號
			# 注意：模式須用 \~ 逸出，否則 [[ ]] 會先對 ~ 做 tilde expansion（展成 $HOME）
			# 導致永遠比對不到字面上的 "~/.claude/..." 字串（已實測踩坑修正）
			if [[ "$raw" == \~/.claude/* ]]; then
				rel="${raw#\~/.claude/}"
			else
				rel="$raw"
			fi
			[ -z "$rel" ] && continue
			# .ab-tao/runtime/ 下的檔案為執行期懶建（jsonl log 等），不存在≠缺件
			case "$rel" in .ab-tao/runtime/*) continue ;; esac
			target="$TARGET_ROOT/$rel"
			if [ ! -e "$target" ]; then
				_add_finding "R2" "${f#"$TARGET_ROOT"/} 引用不存在：$raw"
			fi
		done < <(grep -ohE '~/\.claude/[A-Za-z0-9_./-]+|(hooks|scripts|docs)/[A-Za-z0-9_./-]+' "$f" 2>/dev/null | sort -u)
	done

	# 反向：無 paths: 的 rules 檔必須被 CLAUDE.md 指標引用，否則永遠不會被載入。
	# 上面那圈驗的是「引用 → 檔案存在」，抓不到「檔案還在、指標行被刪」——
	# 而後者正是這類檔案的實際失效路徑（d:setup 用舊 template 覆蓋 CLAUDE.md 即可觸發），
	# 且失效是靜默的：規則檔好端端躺著，只是再也沒有任何東西會去讀它。
	local top_md="$TARGET_ROOT/CLAUDE.md"
	if [ -f "$top_md" ]; then
		local rf rname
		for rf in "$TARGET_ROOT"/rules/*.md; do
			[ -f "$rf" ] || continue
			grep -qE '^paths:' "$rf" 2>/dev/null && continue   # 有 paths: 者由 harness 自動觸發
			rname=$(basename "$rf")
			grep -qF "rules/$rname" "$top_md" 2>/dev/null || \
				_add_finding "R2" "rules/$rname 無 paths: 且未被 CLAUDE.md 指標引用 → 永遠不會被載入"
		done
	fi
}

# ── R3: 文件內 `q.sh <子指令>` 引用是否存在於 q.sh 的 case 分支 ─────
_r3() {
	local qsh="$TARGET_ROOT/skills/kk-graph-v2/q.sh"
	[ -f "$qsh" ] || return
	local valid_cmds
	valid_cmds=$(grep -oE '^[[:space:]]*[a-z][a-z0-9_-]*\)' "$qsh" 2>/dev/null \
		| sed -E 's/^[[:space:]]*//; s/\)$//' | sort -u)
	[ -z "$valid_cmds" ] && return

	local files=("$TARGET_ROOT"/claude-md/*.md "$TARGET_ROOT"/docs/*.md)
	local f ref
	for f in "${files[@]}"; do
		[ -f "$f" ] || continue
		while IFS= read -r ref; do
			[ -z "$ref" ] && continue
			printf '%s\n' "$valid_cmds" | grep -qxF "$ref" || \
				_add_finding "R3" "${f#"$TARGET_ROOT"/} 引用 q.sh 子指令不存在：$ref"
		done < <(grep -ohE 'q\.sh[[:space:]]+[a-z][a-z0-9_-]*' "$f" 2>/dev/null | awk '{print $2}' | sort -u)
	done
}

# ── R4: hooks/defs/*.json ↔ settings.json.hooks 雙向對賬 ───────────
_r4() {
	local defs_dir="$TARGET_ROOT/hooks/defs"
	local settings="$TARGET_ROOT/settings.json"
	[ -d "$defs_dir" ] || return
	[ -f "$settings" ] || return

	local def_file event
	for def_file in "$defs_dir"/*.json; do
		[ -f "$def_file" ] || continue

		# 同一 def 檔內重複 id
		local dup d
		dup=$(jq -r '.hooks[]?.id // empty' "$def_file" 2>/dev/null | sort | uniq -d)
		if [ -n "$dup" ]; then
			while IFS= read -r d; do
				[ -n "$d" ] && _add_finding "R4" "$(basename "$def_file") 內重複 id：$d"
			done <<< "$dup"
		fi

		event=$(jq -r '.event // empty' "$def_file" 2>/dev/null)
		[ -z "$event" ] && continue

		# 幽靈 def：優先以 id 比對，settings 缺 id 時退回 command basename 比對
		local hid hcmd mounted base
		while IFS=$'\t' read -r hid hcmd; do
			[ -z "$hid" ] && continue
			mounted=false
			if jq -e --arg ev "$event" --arg id "$hid" \
				'(.hooks[$ev] // []) | any(.id == $id)' "$settings" >/dev/null 2>&1; then
				mounted=true
			else
				base=$(basename "$hcmd" 2>/dev/null)
				if [ -n "$base" ] && jq -e --arg ev "$event" --arg b "$base" \
					'(.hooks[$ev] // []) | any(.hooks[]?.command // "" | endswith($b))' "$settings" >/dev/null 2>&1; then
					mounted=true
				fi
			fi
			[ "$mounted" = false ] && \
				_add_finding "R4" "幽靈 def：$(basename "$def_file") 的 ${hid}（${event}）未見於 settings.json.hooks"
		done < <(jq -r '.hooks[]? | [(.id // ""), (.hooks[0].command // "")] | @tsv' "$def_file" 2>/dev/null | sort -u)
	done

	# 死掛載：settings.json 的 command 指向不存在的腳本
	local cmd script_path
	while IFS= read -r cmd; do
		[ -z "$cmd" ] && continue
		script_path=$(printf '%s' "$cmd" | sed -E 's/^bash[[:space:]]+//')
		script_path=$(printf '%s' "$script_path" | sed "s|\$HOME|$HOME|g; s|~|$HOME|g" | awk '{print $1}')
		[ -z "$script_path" ] && continue
		[ -f "$script_path" ] || _add_finding "R4" "死掛載：settings.json 的 command 指向不存在的腳本：$cmd"
	done < <(jq -r '.hooks // {} | to_entries[] | .value[] | .hooks[]?.command // empty' "$settings" 2>/dev/null | sort -u)

	# 無主掛載：settings.json 掛了 hook，但 defs/ 沒有對應的自我文件化 def 檔。
	# 2026-08-13 新增：原本 R4 只驗「defs → settings」單向，抓不到這個反向缺口
	#（實例：pre-tool-pg-prod-guard、session-start-kkday-mcp 兩支活躍 hook 長期缺 def）。
	local base_name
	while IFS= read -r cmd; do
		[ -z "$cmd" ] && continue
		script_path=$(printf '%s' "$cmd" | sed -E 's/^bash[[:space:]]+//' | awk '{print $1}')
		base_name=$(basename "$script_path" 2>/dev/null)
		base_name="${base_name%.sh}"
		[ -z "$base_name" ] && continue
		# statusline 不走 hooks 事件機制、plugin 提供的 hook 不歸本地 defs 管
		case "$script_path" in *"/plugins/"* | *statusline*) continue ;; esac
		grep -rqlF "$(basename "$script_path")" "$defs_dir"/*.json 2>/dev/null || \
			_add_finding "R4" "無主掛載：settings.json 掛了 $(basename "$script_path") 但 defs/ 無對應 def 檔"
	done < <(jq -r '.hooks // {} | to_entries[] | .value[] | .hooks[]?.command // empty' "$settings" 2>/dev/null | sort -u)
}

# ── R5: settings.json._abTao.* 各鍵有無消費者 ────────────────────
# 注意：刻意用 find -name + grep（不用 grep --include）——實測 grep --include
# 在部分環境（如 ugrep 包裝的 grep）解析失序、範圍會被靜默放大成全檔案掃描，
# 造成假陰性（誤判為「有消費者」），故不採用
_r5() {
	local settings="$TARGET_ROOT/settings.json"
	[ -f "$settings" ] || return
	# 2026-07-18：voiceTrigger/skillCreatorEnabled 確認棄用並清鍵（原暫列 allow 已移除）
	local allow="${R5_ALLOW:-version}"
	local keys key found
	keys=$(jq -r '._abTao // {} | keys[]?' "$settings" 2>/dev/null)
	[ -z "$keys" ] && return

	local search_specs=("$TARGET_ROOT/hooks:sh")
	if [ -d "$HOME/ab-projects/ab-tao" ]; then
		search_specs+=("$HOME/ab-projects/ab-tao:sh" "$HOME/ab-projects/ab-tao:mjs")
	fi

	while IFS= read -r key; do
		[ -z "$key" ] && continue
		printf '%s\n' "$allow" | tr ',' '\n' | grep -qxF "$key" && continue
		found=false
		local spec dir ext
		for spec in "${search_specs[@]}"; do
			dir="${spec%%:*}"
			ext="${spec#*:}"
			[ -d "$dir" ] || continue
			if find "$dir" -type f -name "*.${ext}" -print0 2>/dev/null \
				| xargs -0 grep -lF -- "$key" 2>/dev/null | grep -q .; then
				found=true
				break
			fi
		done
		[ "$found" = false ] && _add_finding "R5" "_abTao.$key 無消費者（僅宣告於 settings.json）"
	done <<< "$keys"
}

# ── R6: 列舉合法性（易擴充規則表，格式 "欄位:合法值1|合法值2"）───────
_r6() {
	local settings="$TARGET_ROOT/settings.json"
	[ -f "$settings" ] || return
	local ENUM_RULES=(
		"costRouting:dynamic|static"
	)
	local rule field legal val
	for rule in "${ENUM_RULES[@]}"; do
		field="${rule%%:*}"
		legal="${rule#*:}"
		val=$(jq -r --arg f "$field" '._abTao[$f] // empty' "$settings" 2>/dev/null)
		[ -z "$val" ] && continue
		if ! printf '%s' "|$legal|" | grep -qF "|$val|"; then
			_add_finding "R6" "_abTao.${field} 值非法：${val}（合法值：${legal//|/, }）"
		fi
	done
}

# ── R7: skills/*/SKILL.md frontmatter description 長度 + 引用 skill 存在性 ─
_r7() {
	local skills_dir="$TARGET_ROOT/skills"
	[ -d "$skills_dir" ] || return
	local known_skills
	known_skills=$(basename -a "$skills_dir"/*/ 2>/dev/null)

	local skill_path name smd desc desc_len refs ref
	for skill_path in "$skills_dir"/*/; do
		[ -d "$skill_path" ] || continue
		name=$(basename "$skill_path")
		smd="${skill_path}SKILL.md"
		[ -f "$smd" ] || continue

		desc=$(awk '
			/^---[[:space:]]*$/ { c++; next }
			c==1 && /^description:/ { sub(/^description:[[:space:]]*>?[[:space:]]*/, ""); found=1; buf=$0; next }
			c==1 && found && /^[a-z_-]+:/ { exit }
			c==1 && found { buf = buf " " $0 }
			c==2 { exit }
			END { print buf }
		' "$smd")
		# 必須在 UTF-8 locale 下數字元（見檔頭 UTF8_LOCALE 說明），
		# 直接用 ${#desc} 或無 locale 的 wc -m 在 C locale 下都會算成 bytes。
		desc_len=$(printf '%s' "$desc" | LC_ALL="$UTF8_LOCALE" wc -m | tr -d ' ')
		if [ "$desc_len" -gt 0 ] && { [ "$desc_len" -lt 50 ] || [ "$desc_len" -gt 200 ]; }; then
			# 觸發密集型 skill（「無感優先」類）刻意超長以保觸發召回，豁免上限（仍受平台 1024 約束）。
			# 2026-08-13 改為「句式自動偵測 + 人工白名單」雙軌：純人工白名單已落後過一次
			# （只收錄 4 個，實際有 9 個同設計動機的 skill 超標，長期製造 9 筆噪音 finding）。
			local len_allow="${R7_LEN_ALLOW:-agent-orchestration,kk-graph-v2,kkday-design-system,visual-explainer}"
			local trigger_dense=false
			# 只有「超過上限」才適用豁免；低於 50 字元代表 description 太薄，一律照報。
			if [ "$desc_len" -gt 200 ] && printf '%s' "$desc" \
				| grep -qiE 'use (this )?when|use whenever|when the user (asks|wants|mentions)|觸發時機|觸發條件|關鍵字觸發|時觸發|當使用者|使用者(說|問|要求|提到)'; then
				trigger_dense=true
			fi
			if [ "$trigger_dense" != true ]; then
				printf '%s\n' "$len_allow" | tr ',' '\n' | grep -qxF "$name" || \
					_add_finding "R7" "skills/$name/SKILL.md description 長度 ${desc_len} 字元，超出 50–200 範圍"
			fi
		fi

		# 本文以 backtick 包住、含連字號的詞視為疑似 skill 名引用
		# 排除 markdown 表格列（多為 token/參數對照表，非「引用 skill」語境，降噪）
		refs=$(grep -v '^[[:space:]]*|' "$smd" 2>/dev/null \
			| grep -ohE '`[a-z][a-z-]{5,}`' | tr -d '`' | sort -u)
		[ -z "$refs" ] && continue
		while IFS= read -r ref; do
			[ -z "$ref" ] && continue
			[[ "$ref" == *-* ]] || continue
			[ "$ref" = "$name" ] && continue
			printf '%s\n' "$known_skills" | grep -qxF "$ref" && continue
			# 只在 ref 確為「已封存 skill 名」時告警（曾是 skill → 真斷鏈）；
			# 任意連字號詞（DS token/CSS/套件名）不猜測，避免假陽性洗版
			if ls -d "$TARGET_ROOT"/.skills-archived/*/"$ref" "$TARGET_ROOT"/../ab-projects/ab-tao/apps/dotfiles/claude/skills-archive/"$ref" >/dev/null 2>&1 \
			   || ls -d "$HOME"/ab-projects/ab-tao/apps/dotfiles/claude/skills-archive/"$ref" >/dev/null 2>&1; then
				_add_finding "R7" "skills/$name/SKILL.md 引用的 skill 已封存：$ref"
			fi
		done <<< "$refs"
	done
}

# ── R8: 明文 secret 掃描（settings.json、~/.claude.json）───────────
_r8() {
	local files=("$TARGET_ROOT/settings.json" "$HOME/.claude.json")
	# label:regex；R8_ALLOW 預設含 anysearch-bearer
	# —— 使用者已知悉並刻意保留該 token（Kkday anysearch MCP 設定），非洩漏
	local PATTERNS=(
		"github-pat:gho_[A-Za-z0-9]{20,}"
		"anysearch-bearer:Bearer[[:space:]]+as_sk_[A-Za-z0-9]+"
		"openai-style:sk-[A-Za-z0-9]{20,}"
	)
	local R8_ALLOW="${R8_ALLOW:-anysearch-bearer}"
	local f entry label pat matches m
	for f in "${files[@]}"; do
		[ -f "$f" ] || continue
		for entry in "${PATTERNS[@]}"; do
			label="${entry%%:*}"
			pat="${entry#*:}"
			printf '%s\n' "$R8_ALLOW" | tr ',' '\n' | grep -qxF "$label" && continue
			matches=$(grep -ohE "$pat" "$f" 2>/dev/null | sort -u)
			[ -z "$matches" ] && continue
			while IFS= read -r m; do
				[ -z "$m" ] && continue
				_add_finding "R8" "$f 疑似明文 secret（$label）：${m:0:12}…（已遮蔽）"
			done <<< "$matches"
		done
	done
}

# ── R9: 殘留檔 pattern ────────────────────────────────────────────
_r9() {
	local top="$TARGET_ROOT"
	local hooks_dir="$TARGET_ROOT/hooks"

	# *.bak*（頂層 + hooks/）
	local bak
	while IFS= read -r bak; do
		[ -n "$bak" ] && _add_finding "R9" "殘留備份檔：$bak"
	# 2026-08-13 修：原本只掃 $top 與 $hooks_dir，claude-md/ 下的 .bak 永遠抓不到
	#（實例：05-security.md.bak-20260806-180337 存活 7 天沒被任何機制發現）。
	done < <({ find "$top" -maxdepth 1 -iname '*.bak*' 2>/dev/null; \
		find "$hooks_dir" -maxdepth 1 -iname '*.bak*' 2>/dev/null; \
		find "$TARGET_ROOT/claude-md" "$TARGET_ROOT/rules" "$TARGET_ROOT/docs" \
			-maxdepth 1 -iname '*.bak*' 2>/dev/null; })

	# "<name> <N>[.ext]" race-condition 殘留（頂層 + hooks/ + .ab-tao/）
	local resid_dir resid bn
	for resid_dir in "$top" "$hooks_dir" "$TARGET_ROOT/.ab-tao"; do
		[ -d "$resid_dir" ] || continue
		while IFS= read -r resid; do
			[ -z "$resid" ] && continue
			bn=$(basename "$resid")
			printf '%s' "$bn" | grep -Eq '^.+ [0-9]+(\.[A-Za-z0-9]+)?$' && \
				_add_finding "R9" "race-condition 殘留檔：$resid"
		done < <(find "$resid_dir" -maxdepth 1 -type f -name '* [0-9]*' 2>/dev/null)
	done

	# 頂層殘留 security_warnings_state_*
	local sw
	while IFS= read -r sw; do
		[ -n "$sw" ] && _add_finding "R9" "頂層殘留 security_warnings_state 檔：$sw"
	done < <(find "$top" -maxdepth 1 -name 'security_warnings_state_*' 2>/dev/null)

	# backups/ 超過 10 份
	local backups_dir="$TARGET_ROOT/backups"
	if [ -d "$backups_dir" ]; then
		local n
		n=$(find "$backups_dir" -maxdepth 1 -name '.claude.json.backup.*' -type f 2>/dev/null | wc -l | xargs)
		[[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -gt 10 ] && \
			_add_finding "R9" "backups/ 有 $n 份 .claude.json.backup.*，超過保留上限 10"
	fi
}

# ── R10: settings.json.hooks 事件名合法性（反向對賬，補 R4 缺口）──
# R4 只從 defs/ 單向反查 settings.json，事件名打錯（如 DirectoryAdd）會靜默失效——
# hook 永不觸發且無任何報錯。此處反向枚舉 settings.json.hooks 的 key 比對合法事件表。
# 白名單動態取自 VS Code extension 隨版本更新的 settings schema，不硬編碼（避免新版新增事件後誤報）；
# 未裝 extension / 抽不到 enum 則整條跳過，維持 warn-only 不阻斷的慣例。
_r10() {
	local settings="$TARGET_ROOT/settings.json"
	[ -f "$settings" ] || return

	# 取版本號最大的一份 extension schema
	local schema
	schema=$(find "$HOME/.vscode/extensions" -maxdepth 2 \
		-name 'claude-code-settings.schema.json' -path '*anthropic.claude-code-*' 2>/dev/null |
		sort -V | tail -1)
	[ -n "$schema" ] && [ -f "$schema" ] || return

	# 合法事件表：properties.hooks.propertyNames 底下所有 enum（不寫死 anyOf 索引，防 schema 結構微調）
	local valid
	valid=$(jq -r '.properties.hooks.propertyNames? // {} | [.. | objects | .enum? // empty | .[]] | unique[]' \
		"$schema" 2>/dev/null)
	[ -z "$valid" ] && return

	local ev
	while IFS= read -r ev; do
		[ -z "$ev" ] && continue
		printf '%s\n' "$valid" | grep -qxF "$ev" || \
			_add_finding "R10" "settings.json.hooks 事件名不在合法表：${ev}（該 hook 永不觸發；合法表取自 $(basename "$(dirname "$schema")")）"
	done < <(jq -r '.hooks // {} | keys[]' "$settings" 2>/dev/null)
}

# ── R11：source ↔ 部署端同步驗證 ────────────────────────────────
# 2026-08-13 新增。背景：state.json 的 managed 為空物件（這台機器從未跑完整 d:setup），
# 導致 session-start.sh 的 config drift 偵測迴圈 0 次 = 假保護，雙向 drift 長期無警告累積。
# d:setup 本身不能用來修（需 TTY，且其「舊配置清理」推薦項會誤刪正確配置），
# 改以 ab-tao 自帶的 verify-claude-sync.mjs（/check 的 Gate 7）作為 drift 偵測來源。
_r11() {
	local repo="$HOME/ab-projects/ab-tao"
	local verifier="$repo/apps/dotfiles/bin/verify-claude-sync.mjs"
	[ -f "$verifier" ] || return          # 沒有 source repo 的機器（純部署端）直接跳過
	command -v node >/dev/null 2>&1 || return

	local out summary
	out=$(cd "$repo" && node "$verifier" 2>/dev/null)
	[ $? -eq 0 ] && return                # exit 0 = 全部同步，無 finding

	summary=$(printf '%s' "$out" | grep -m1 '結論' | sed 's/^[[:space:]]*//')
	[ -z "$summary" ] && summary="verify-claude-sync 回報未同步"
	_add_finding "R11" "source↔部署端同步：${summary}（詳情跑 node ${verifier#"$HOME"/})"
}

# ── 主流程 ──────────────────────────────────────────────────────
_r1
_r2
_r3
_r4
_r5
_r6
_r7
_r8
_r9
_r10
_r11

if [ "${#FINDINGS[@]}" -eq 0 ]; then
	echo "[config-lint] OK：0 項靜默失效"
else
	echo "[config-lint] 發現 ${#FINDINGS[@]} 項疑似靜默失效："
	for finding in "${FINDINGS[@]}"; do
		echo "  $finding"
	done
fi

exit 0
