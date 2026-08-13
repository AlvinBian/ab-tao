---
name: confluence
description: Confluence 頁面操作規範 — 頁寬一律 Max(full-width)、元件（table/expand/diagram）寬度拉滿、storage 格式保 macro、Mermaid forge 圖配對、Expand 拉滿鋪開、更新前 version 檢查防互蓋、描述資訊一律 list 化。建立/更新 Confluence 頁面時載入。
---

<confluence>

## 1. 頁寬一律 Max（full-width）（強制）

**凡新建或大幅改寫 Confluence 頁面，完成後必須把頁寬設為 Max（full-width）**，已發布視圖與草稿一起設，否則表格/寬圖在預設 fixed-width 下會擠壓。

- MCP 工具（confluence_create_page / update_page）**無頁寬參數**，須走 REST content property：
  - `content-appearance-published` = `full-width`
  - `content-appearance-draft` = `full-width`（兩個都設，缺 draft 下次編輯會回窄版）
- API：`GET/PUT /wiki/rest/api/content/{id}/property/{key}`（存在→PUT 帶 `version.number+1`；404→POST 建立 `{key, value}`）
- 憑證來源：由本機 mcp-atlassian 服務提供（`CONFLUENCE_URL` / `USERNAME` / `API_TOKEN`），僅存記憶體、禁列印落地、禁寫入任何檔案
- ⚠️ 一律用 python urllib 發請求，勿用 curl（本機 curl 有被改寫成 POST 的坑）
- ⚠️ 實測（2026-07-20）：**MCP update 內容後 page_width 會被重置回 fixed-width**——每次內容更新後都要重設兩個 property（批次更新多頁時，最後統一跑一輪頁寬腳本最省）

## 2. 內容格式

- 改既有頁面一律先 `convert_to_markdown=false` 取 **storage 原文**再改；用 markdown 全頁覆寫會**清掉** mermaid adf-extension、note/panel、status macro、decision-list、task-list 等區塊（實例：某內部規格頁曾被 markdown 覆寫毀掉 forge mermaid widget，事後須重建）
- 保留原有 `ac:task-uuid` / `local-id`（task 勾選狀態與 decision 綁定其上）

## 3. Mermaid 渲染圖（Forge「Mermaid diagram」app 站點適用）

- 一張渲染圖＝一個 `ac:adf-extension`（Mermaid diagram widget，`guest-params.index=N`）＋頁內**第 N 個** `language=mermaid` 的 code macro（0-based）配對
- **源碼必帶 frontmatter title（強制）**：每段 mermaid 源碼開頭必須有 `---` / `title: <圖名>` / `---` 三行 frontmatter，不得缺少（渲染圖會顯示標題、源碼自我描述）；批次補 title 腳本須**冪等**——已以 `---` 開頭者跳過，且只插 frontmatter 不動圖內容（防蓋平行編輯）
- 只放 code macro 不放 widget＝只顯示源碼不渲染
- 慣例：widget 在前、緊接直接鋪開 mermaid 源碼 code block（見規則 4，不再包 expand）；**所有 mermaid code block 排在其他 code block（如 SQL）之前**，避免 index 配對被干擾；單頁單圖（index 0）最穩

## 4. Expand 使用準則（2026-07-20 使用者拍板修訂）

**敘事內容一律直接鋪開**（表格/清單/說明不藏摺疊層）；**唯一例外＝流程圖源碼**：

- **mermaid / diagram「源碼」code block 一律收 expand**（title＝「Diagram 源碼 · <圖名>」），**上方必須有對應渲染圖**（forge widget 或 macro-diagram）——讀者先看圖、要源碼再展開
- 渲染圖本體永不收 expand；SQL / 設定檔等非圖源碼依「拉滿鋪開」原則直接鋪開
- 與規則 3 的關係：mermaid widget 的 index 配對只看「第 N 個 language=mermaid code block」，與是否包 expand 無關

## 5. TBD 標記顏色標準（2026-07-20 使用者定案）

裸「TBD」文字禁止直接留在頁面，一律用 status macro 上色＋一句「誰/何時回填」：

- <strong>Red「TBD·待外部」</strong>＝需外部團隊（DevOps / data / cloud / 資安）給值
- <strong>Yellow「TBD·待我方」/「TBD·待業務方」</strong>＝我方觸發或業務方提供後即可回填
- 已定案就不標 TBD——直接寫實際值；有建議值的 TBD 附建議值與出處（如 repo 檔案）
- 定期逐項覆核「是否真的還是 TBD」，覆核日期與結論註記於頁面凡例；凡例（顏色定義）集中放主申請頁，其他頁只用 macro 不重複凡例
- 同一事項跨頁出現時顏色必須一致（例：需外部團隊指認的事項，在主頁與各子頁都是 Red·待外部）

## 6. 更新前 version 檢查（強制·防平行編輯互蓋）

多 session / 多人可能同時編輯同一頁。**每次 update 前必須重查當前 version 與自己讀取時的 version 比對**：

- version 未前進 → 正常更新
- version 已前進 → **禁止直接覆寫**：先 `confluence_get_page_diff` 比對中間版本改了什麼 → 合併雙方增量後再更新，並於 version_comment 註明「合併 vN」
- 更新後檢查回傳 version 是否恰為「讀取版 +1」；跳號＝中間有別人寫入，立即 diff 核對是否誤蓋
- 教訓案例：曾發生 vN（平行 session 的模板重構）被基於 vN-1 的全文替換誤蓋，事後手工合併補救

## 7. 元件寬度拉滿（強制·與 §1 頁寬配套）

頁寬 Max 只放大版心；**頁內可設寬度的元件也要一律 full-width**，否則表格仍窄縮置中：

- **table**：`<table data-layout="full-width">`——`default` / `wide` / `center` / 無屬性者一律改
  - ⚠️ **編輯器變體**：經 Confluence UI 手動編輯過的表格 tag 會變成 `<table data-table-width="760" data-layout="default|center" ac:local-id="…">`——嚴格比對 `<table data-layout="default">` 會漏抓；轉換用寬鬆 regex `(<table[^>]*?) data-layout="(?:default|center|wide)"`，並**移除 `data-table-width="N"`**（固定寬會限縮 full-width），`ac:local-id` 保留
- **expand**（依 §4 僅 Diagram 源碼使用）：`data-layout="full-width"`（原 `wide`+breakoutWidth 一律升級）
- **mermaid adf-extension**（渲染 widget）：`<ac:adf-attribute key="layout">full-width</ac:adf-attribute>`（主體與 `<ac:adf-fallback>` 內同步改；`parameters` 裡的 `layout=extension` 為固定值勿動）
- **新建頁面直接帶 full-width 屬性**，免事後補跑
- 批次調整既有頁的腳本模式：GET storage（記 version）→ 字串轉換 → PUT `version+1`（§6 衝突即停）→ 重設頁寬 property（§1）；拆巢狀 macro 勿用貪婪 regex，以 `<ac:structured-macro>` 開閉配對計深度定位

## 8. 描述資訊一律 list 化（2026-07-21 使用者拍板）

**描述性資訊盡量用 list（ol/ul）呈現，保證條理結構清晰**；禁止把多個要點擠在同一長句段落：

- **行內編號串（①②③…）一律拆為真清單**：`<ol><li><p>…</p></li></ol>`，不得以 ①②③ 塞在單一 `<p>` 內
- **頓號／分號／「｜」串接的多要點長句**：≥3 個要點就拆 list；lead-in 句（「XXX：」）保留為引導段，要點逐條成 `<li>`
- **一條 bullet 只講一件事**：bullet 內若含多層資訊（決策句＋佐證＋規格），改為「引導句＋巢狀 `<ul>`」結構
- **參考文件／引用清單**：按主題分組為巢狀清單，勿以分隔符擠成單條 mega-bullet
- **例外**：敘事性短段（1-2 句因果論述）、表格 cell 內容、狀態列（status macro＋一句話）維持原樣，不硬拆
- 與 §4 不衝突：list 直接鋪開（不包 expand）；表格仍優先於 list 用於「欄位對照」型資訊

</confluence>
