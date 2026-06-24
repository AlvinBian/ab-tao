#!/usr/bin/env bash
# user-prompt-enrich.sh — UserPromptSubmit：偵測 prompt 關鍵字，注入相關 context
# kill-switch: CLAUDE_PROMPT_ENRICH=0

[ "${CLAUDE_PROMPT_ENRICH:-1}" = "0" ] && exit 0
command -v jq &>/dev/null || exit 0

INPUT=$(cat)
PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty' 2>/dev/null)
[ -z "$PROMPT" ] && exit 0

EXTRA=""

# Rule 1: Jira ticket 號（VM-xxxx / KD-xxxx）
if printf '%s' "$PROMPT" | grep -Eq '(VM|KD)-[0-9]+'; then
	TICKET=$(printf '%s' "$PROMPT" | grep -Eo '(VM|KD)-[0-9]+' | head -1)
	EXTRA="${EXTRA}[Enrich] 偵測到 Jira ticket ${TICKET}。如需詳情可用 Jira MCP (getJiraIssue / searchJiraIssuesUsingJql) 查詢後納入 context。\n"
fi

# Rule 2: Confluence URL（自動提示 page ID）
if printf '%s' "$PROMPT" | grep -Eq 'confluence\.kkday\.com'; then
	PAGE_ID=$(printf '%s' "$PROMPT" | grep -Eo 'pages/[0-9]+' | grep -Eo '[0-9]+' | head -1)
	if [ -n "$PAGE_ID" ]; then
		EXTRA="${EXTRA}[Enrich] 偵測到 Confluence 頁面 ID ${PAGE_ID}。可用 getConfluencePage 工具查詢內容。\n"
	else
		EXTRA="${EXTRA}[Enrich] 偵測到 Confluence URL。可用 Confluence MCP 工具查詢對應頁面內容。\n"
	fi
fi

# Rule 3: 破壞性命令關鍵字 → 預先對齊 §6 串流中斷規則
if printf '%s' "$PROMPT" | grep -Eiq '(rm[[:space:]]+-rf|--force|--no-verify)'; then
	EXTRA="${EXTRA}[Enrich] Prompt 含破壞性命令關鍵字。依 §6 串流中斷：rm -rf / --force / --no-verify 需二次確認，明說「hotfix 緊急」才豁免。\n"
fi

# 無注入 → 靜默退出（不影響 prompt 流程）
[ -z "$EXTRA" ] && exit 0

# Telemetry（background，不阻塞）
{
	mkdir -p "$HOME/.claude/telemetry"
	printf '{"ts":"%s","hook":"user-prompt-submit","rule":"enrich","matched":true}\n' \
		"$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" \
		>> "$HOME/.claude/telemetry/rule-hits-${HOSTNAME%%.*}.jsonl" 2>/dev/null
} &

jq -nc --arg ctx "$(printf '%s' "$EXTRA" | head -c 800)" '{"additionalContext": $ctx}'
