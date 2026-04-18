# ── Shell 行為選項 ────────────────────────────────────────────────

# 目錄導航
setopt AUTO_CD              # 打目錄名直接 cd（無需輸入 cd）
setopt AUTO_PUSHD           # cd 自動推入目錄堆疊（可 cd - 返回）
setopt PUSHD_SILENT         # 靜音 pushd（不列印堆疊）
setopt PUSHD_IGNORE_DUPS    # 目錄堆疊去重

# 安全 & 互動
setopt NO_BEEP              # 靜音終端鈴聲
setopt INTERACTIVE_COMMENTS # 互動模式允許 # 行內註釋

# Glob 擴展
# 注意：EXTENDED_GLOB 啟用後 #、~、^ 有特殊意義，含這些字元的參數需引號包裹
setopt EXTENDED_GLOB        # 擴展 glob 語法（^pattern、str~excl、pat#）

# 補全行為
setopt COMPLETE_IN_WORD     # 游標位置補全（非僅末尾）
setopt ALWAYS_TO_END        # 補全後游標移到詞尾

# 任務控制
setopt LONG_LIST_JOBS       # jobs 輸出顯示 PID
setopt NO_HUP               # shell 退出時不殺背景任務
