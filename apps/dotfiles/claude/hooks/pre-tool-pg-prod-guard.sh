#!/bin/bash
# ============================================================
# PreToolUse Hook — PROD 查詢守門（harness 層，AI 無法繞過）
# ============================================================
# 來源：kkday-it/scm-ai-handbook .claude/hooks/require-prod-approval.sh（全局化 + 補寫入攔截）
# 註冊於 hooks/defs/pre-tool-pg-prod-guard.json，matcher = "mcp__pg-prod__.*"
# 行為（看得懂 SQL 內容）：
#   - 非唯讀語句（INSERT / UPDATE / DELETE / DDL）→ deny，直接擋。
#   - 明顯危險的 prod 查詢（無 WHERE / 無 LIMIT / 前綴萬用字 LIKE）→ deny，直接擋。
#   - 其餘 prod 工具呼叫 → ask，跳確認框，使用者同意才執行。
#   - AI 不可自主查 prod；伺服器端另有 EXPLAIN 預檢 + 靜態守門（server.py）為第二道。
# 為避免引號問題，INPUT 經環境變數傳入 python heredoc 解析。
# ============================================================
set -e
INPUT=$(cat)

CLAUDE_HOOK_INPUT="$INPUT" python3 <<'PY'
import os, json, re

try:
    d = json.loads(os.environ.get("CLAUDE_HOOK_INPUT", "{}") or "{}")
except Exception:
    d = {}

ti = d.get("tool_input", {}) or {}
tool = d.get("tool_name", "")
db = ti.get("database", "")
sql = (ti.get("sql") or "").strip()
u = sql.upper()

reasons = []
# 非唯讀語句一律擋（server 端也擋，這裡是 harness 層第一道）
if sql and not re.match(r"^\(*\s*(SELECT|WITH|EXPLAIN)\b", u):
    reasons.append("非唯讀語句（prod 僅允許 SELECT / WITH）")
# 只對 query 工具的 SELECT/WITH 做內容檢查（list_tables/describe_table 等無 sql 參數）
elif sql and re.match(r"^\(*\s*(SELECT|WITH)\b", u):
    if not re.search(r"\bWHERE\b", u):
        reasons.append("無 WHERE 條件（恐全表掃描）")
    if not re.search(r"\bLIMIT\s+\d+", u):
        reasons.append("無 LIMIT")
    if re.search(r"I?LIKE\s+'%", u):
        reasons.append("前綴萬用字 LIKE（'%...，無法用索引）")

if reasons:
    decision = "deny"
    reason = ("⚠️ PROD 危險查詢已擋下：" + "、".join(reasons)
              + "。請改用索引欄位精準查 + 加 LIMIT（≤100），或自行手動於 DB 端執行。"
              + ((" db=" + db) if db else ""))
else:
    decision = "ask"
    reason = ("⚠️ PROD（正式環境）唯讀查詢"
              + ((" | db=" + db) if db else "")
              + ((" | 工具=" + tool) if tool else "")
              + "。需你明確授權才會執行。")

out = {"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": decision,
    "permissionDecisionReason": reason,
}}
print(json.dumps(out, ensure_ascii=False))
PY
exit 0
