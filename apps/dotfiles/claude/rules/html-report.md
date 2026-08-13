---
name: html-report
description: HTML 報告/展示文稿輸出規範 — kebab-case 命名、結論先行、寬版心＋左側導航欄、全標題錨點分享、流程圖原尺寸、自包含單檔、交付檢核。
paths:
  - "**/*.html"
---

<html_report>

## 適用範圍

本規則管**報告 / 展示型 HTML 交付物**（分析報告、覆蓋率報告、架構說明、計畫回顧、審查結果等給人閱讀的靜態頁面）。
**Artifact 發佈頁同適用**：免 `<!DOCTYPE>`/`<head>` 骨架、且需雙主題設計（§13a 在 Artifact 情境視為必啟），其餘章節（寬版心＋側欄、錨點、圖原尺寸、檢核）照用。

**不適用**：SPA 入口 `index.html`、build 產物、第三方套件內的 HTML、測試 fixture、`frontend/**` 應用程式碼——這些觸發本規則時直接忽略，不套用以下規範。

## 1. 命名與存放

- 檔名全小寫英文 **kebab-case**：`{主題}-{文件類型}.html`，如 `taxonomy-coverage-report.html`、`llm-resilience-plan.html`。禁止中文檔名、空格、底線。
- **一切產生途徑皆適用（強制）**：不只 Write/Edit 直接建檔——Bash/python 腳本生成、`cp`/`mv` 導出到報告資料夾、重命名交付，檔名一律套本規範（此規則按 `**/*.html` 路徑觸發，腳本生成不會自動載入，故列此提醒：**輸出 HTML 報告前先想檔名規範**）。發現既有違規檔名（中文/空格/底線）→ 順手改名為 kebab-case 英文。
- **預設不加日期尾綴**（如 `taxonomy-coverage-report.html`，新版直接覆蓋）；僅在同主題需**多版本並存**時才加 `-YYYYMMDD` 區分歷史版。
- 存放位置：專案已有慣用報告目錄（如本 repo `data/reports/`）→ 沿用；否則放 `reports/` 或使用者指定處。
- `<title>` 與 `<h1>` 內容一致且含主題關鍵字，方便瀏覽器分頁/書籤辨識。

## 2. 結論先行（倒金字塔）

- 首屏固定 **TL;DR 區塊**：3–5 條整體結論 + 3–6 個關鍵數字 KPI 卡，讀者不捲動就看到核心結論。
- 每個 `<h2>` 區塊的**第一個元素就是該節結論**（視覺化 callout，如色塊/引言樣式），證據、表格、細節放其後。
- 自測標準：讀者只讀 TL;DR + 各節首行 callout 也能得到完整、不失真的認知；細節是佐證而非必讀。

## 3. 錨點與分享連結（核心特性）

- 所有 `<h1>`–`<h4>` 一律帶**穩定語義化 id**（英文 kebab-case，如 `id="coverage-by-model"`），**禁止**用自動流水號（`section-1`、`h-2`）——報告重新產生時既有分享連結不能失效。
- id 必須**全檔唯一**（重複 id 會讓跳轉靜默指向第一個出現處，被分享者看到錯的段落卻不自知）。
- 每個標題 hover 顯示 🔗 圖示，點擊複製「當前完整 URL + `#錨點`」到剪貼簿，讓使用者可直接分享「這份報告的這一段」。
- `scroll-margin-top` 需預留頂部空間（避免固定 header 遮住跳轉目標）；`:target` 偽類高亮被跳轉到的區塊，讓被分享者一眼確認位置正確。
- 純前端零依賴實作（複製即可用，不需外部函式庫）：

```html
<style>
  h1[id], h2[id], h3[id], h4[id] { scroll-margin-top: 1.5rem; position: relative; }
  h1[id]:target, h2[id]:target, h3[id]:target, h4[id]:target {
    background: #fff3cd; transition: background 1.5s ease;
  }
  .anchor-link {
    opacity: 0; margin-left: .4rem; font-size: .8em; cursor: pointer;
    text-decoration: none; user-select: none;
  }
  h1:hover .anchor-link, h2:hover .anchor-link,
  h3:hover .anchor-link, h4:hover .anchor-link { opacity: .6; }
  .anchor-link:hover { opacity: 1 !important; }
</style>
<script>
  document.querySelectorAll('h1[id],h2[id],h3[id],h4[id]').forEach(function (h) {
    var a = document.createElement('a');
    a.className = 'anchor-link';
    a.textContent = '🔗';
    a.href = '#' + h.id;
    a.onclick = function (e) {
      e.preventDefault();
      var url = location.href.split('#')[0] + '#' + h.id;
      var done = function () {
        var old = a.textContent;
        a.textContent = '✓';
        setTimeout(function () { a.textContent = old; }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {});
      } else {
        var t = document.createElement('textarea');
        t.value = url; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        t.remove();
      }
      history.replaceState(null, '', '#' + h.id);
    };
    h.appendChild(a);
  });
</script>
```

## 4. 目錄與導航（預設＝左側 sticky 導航欄，2026-07-20 使用者定案）

- **預設佈局自帶左側固定導航欄**（配 §9 寬版心的 grid 左欄）：列出全部章節連結、捲動時高亮當前章節（scrollspy）、點擊平滑跳轉。僅章節 <4 的極短頁可省略側欄、退回頂部一行靜態 TOC。
- **側欄連動必須 100% 準確（2026-07-22 使用者定案·踩過）**：scrollspy 一律用**捲動位置確定性計算**——當前章節＝偵測線（`scrollY+90`，與 `scroll-margin-top` 對齊）之上**最後一個**章節標題；**禁止只靠 IntersectionObserver 交叉事件**（長章節捲到中段時偵測帶內無標題，高亮會殘留在錯誤章節）。點擊連結須**立即 setOn ＋ 短鎖 ~800ms**（平滑捲動途中不跳字）；捲到頁底**強制亮最後一節**（短尾節標題永遠到不了偵測線的兜底）；配 `html{scroll-behavior:smooth}`。
- 側欄目錄仍是**混合式雙保險**：`<nav>` 內先寫好**靜態章節連結**（無 JS 環境也完整可見、可點跳），script 只做「高亮當前章節」的增強、不負責生成內容（零空容器）：

```html
<aside class="side">
  <strong>⟦報告簡稱⟧</strong>
  <nav><a href="#sec-a">01 章節A</a><a href="#sec-b">02 章節B</a> …</nav>
</aside>
<!-- ⚠️ scrollspy 與錨點 script 一律放 </body> 前（DOM 解析完才能掃到） -->
<script>
  (function () {
    // 確定性 scrollspy：當前章節 = 偵測線（scrollY+90）之上「最後一個」標題
    // 標題清單直接由 nav 連結的 href 推導 → h2 分節 / section 分節皆通用
    var links = [].slice.call(document.querySelectorAll('.side nav a'));
    var heads = links.map(function (l) {
      return document.getElementById(l.getAttribute('href').slice(1));
    });
    var lockUntil = 0;
    function setOn(i) {
      links.forEach(function (l, j) { l.classList.toggle('on', j === i); });
    }
    function spy() {
      if (Date.now() < lockUntil) return;          // 點擊後短鎖，平滑捲動途中不跳字
      var pos = window.scrollY + 90;               // 偵測線，與 scroll-margin-top 對齊
      var idx = 0;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i] && heads[i].offsetTop <= pos) idx = i;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        idx = heads.length - 1;                    // 頁底兜底：最後一節必亮
      }
      setOn(idx);
    }
    links.forEach(function (l, i) {
      l.addEventListener('click', function () {
        setOn(i);                                  // 點擊立即亮，不等捲動事件
        lockUntil = Date.now() + 800;
      });
    });
    addEventListener('scroll', spy, { passive: true });
    addEventListener('resize', spy);
    addEventListener('hashchange', spy);
    spy();
  })();
</script>
```

- 窄螢幕（<900px）側欄轉為頂部靜態區塊（grid 退一欄），不擠壓正文；`@media print` 隱藏側欄。

- **禁止「空容器等 JS 填充」**（踩過）：報告常被無 JS 的檢視器打開（聊天側欄預覽、部分內嵌 viewer），script 不執行時帶樣式的空容器會渲染成一個無內容的空框。凡靠 JS 增強的元素，無 JS 時要嘛已有靜態內容（如上方混合式 TOC），要嘛預設不可見（`hidden` 屬性由 JS 解除），不得留視覺殘骸。

- 有側欄時「回到頂部」按鈕可省（側欄本身即隨時可達的導航）；無側欄短頁正文超過 3 屏才加。
- 長表格 `<thead>` 用 `position: sticky` 固定表頭。

## 5. 圖優先於文字

- 涉及流程 / 管線 / 架構 / 因果鏈的說明 → **必附圖**，不要只用文字描述多步驟流程。
- 每張圖 = 圖題 + 圖體 + 1–2 句 caption 說明「這張圖在講什麼」。
- 簡單線性流程（≤6 節點）→ 用 HTML/CSS flex + 箭頭字元（`→`/`▸`）拼流程盒即可；分支或複雜結構 → 用 inline SVG。
- 複雜圖**可以**先用外部工具產出（mermaid CLI、draw.io、Excalidraw 匯出 SVG）再內嵌——鐵律只約束「最終產物 inline、執行期零外連」，不限制產圖工具。
- **禁止外連 CDN**（如 mermaid.js script 標籤），違反下方「自包含單檔」鐵律；圖中文字必須是真實可選取/可搜尋的文字節點，不能是點陣圖裡的文字。
- **圖一律原尺寸渲染、禁止整圖縮小（2026-07-20 使用者定案）**：SVG 以自然尺寸呈現（`.figure svg{max-width:none;height:auto}`）、圖內文字字級 ≥14px；超寬圖放進 `overflow-x:auto` 的圖卡容器內橫向捲動。**禁止**用 `max-width:100%` 把寬圖等比縮到文字不可讀——寬圖優先「重排」（改直式、合併節點、拆段）讓自然寬度落在版心內，橫捲是最後手段。
- **⚠️ mermaid 原始碼區塊只在 claude.ai Artifact 會被渲染（2026-07-20 踩坑）**：`<pre class="mermaid">` / ```` ```mermaid ```` 是 Artifact 平台的原生功能；同一檔導出成本地 HTML 後瀏覽器只會印出原始碼文字。**凡要落地成檔案交付的報告，mermaid 一律先渲染成 inline SVG 再嵌入**。已驗證的離線渲染路徑：下載 `mermaid.min.js` → 本機起 stdlib http.server → `Chrome --headless=new --virtual-time-budget=20000 --dump-dom` 載入渲染頁、頁面把 SVG POST 回落盤 → 依序替換回 `<pre class="mermaid">` 區塊（以 `</svg>` 作區塊終點錨，勿用 `</div>`——svg 的 foreignObject 內含 `</div>` 會讓非貪婪比對提早截斷）。

## 6. 簡明與資訊密度

- 一份報告只講一個主題；正文控制在約 10 屏內，超出就拆成多份報告或把原始數據收進 `<details>` 摺疊區塊。
- 段落 ≤4 行；能用表格就不用長段落，能用 KPI 卡就不用表格。刪掉「不影響讀者下一步理解/行動」的細節。
- 禁止把原始 log、dump、大段 JSON 直接堆進正文——要保留就放 `<details><summary>展開原始數據</summary>...</details>`。
- 資料可能為空的區塊（表格 / 卡片 / 清單），空時必須渲染明確空狀態文字（如「本期無資料」），**禁止輸出空表格、空卡片、空容器**——空白區塊會讓讀者以為頁面壞掉或內容漏產。

## 6a. 一鍵複製（程式碼／長文本 · 2026-07-22 使用者定案）

- **所有 `pre` 程式碼區塊與長文本區塊**（SQL / log / config / 指令等可複製內容）右上角**一律附一鍵複製按鈕**：點擊複製整塊原文，按鈕回饋「✓ 已複製」~1.2s 後還原。
- 按鈕**由 JS 生成**（呼應 §4 零殘骸原則：無 JS 環境不留死按鈕）；`@media print` 隱藏。
- 複製文字在**注入按鈕前**以 `textContent` 捕捉（`innerText` 對 `<details>` 摺疊中的內容可能取空；且捕捉在前才不會把按鈕文字一起複製進去）。
- 零依賴實作（`navigator.clipboard` 失敗自動退回 textarea + `execCommand`，與 §3 錨點複製同套路）：

```html
<style>
  .copywrap{position:relative}
  .copy-btn{position:absolute;top:.45rem;right:.6rem;font-size:12px;
        padding:.15rem .55rem;border:1px solid #cfd8e0;border-radius:6px;
        background:#fff;color:#4b6b8a;cursor:pointer;opacity:.75}
  .copy-btn:hover{opacity:1}
  @media print{.copy-btn{display:none}}
</style>
<script>
  (function () {
    document.querySelectorAll('pre').forEach(function (pre) {
      var txt = pre.textContent;                 // 先捕捉，再注入按鈕
      var wrap = document.createElement('div');
      wrap.className = 'copywrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);                     // 包一層定位容器，按鈕不隨 pre 橫向捲動
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'copy-btn'; b.textContent = '📋 複製';
      b.onclick = function () {
        var done = function () {
          b.textContent = '✓ 已複製';
          setTimeout(function () { b.textContent = '📋 複製'; }, 1200);
        };
        var fallback = function () {
          var t = document.createElement('textarea');
          t.value = txt; document.body.appendChild(t); t.select();
          try { document.execCommand('copy'); done(); } catch (err) {}
          t.remove();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done).catch(fallback);
        } else { fallback(); }
      };
      wrap.appendChild(b);
    });
  })();
</script>
```

## 7. 數據口徑與可信度

- 每個關鍵數字必須能回答：來源是什麼、樣本範圍多大、計算口徑為何（獨立「計算方式」小節或就地一句話說明）。
- 推斷或未經驗證的結論用 ✅/⚠️/❓ 三態標示（沿用全域 `self-correction` 規則的標示語意），禁止把 ⚠️/❓ 級別的內容用確定語氣寫出。
- TL;DR 每條結論可前置狀態標籤（🟢 達標 / 🔴 風險 / 🟡 待決策），讓掃讀者秒判各結論性質。
- 報告末固定「**生成資訊 footer**」：報告生成時間（含時區，如 `2026-07-16 14:30 Asia/Taipei`）、數據快照時間、樣本量、產生方式（腳本名/指令）——避免被誤當即時數據，也讓任何人可追溯重現。

## 8. 自包含單檔與內容安全（鐵律）

- CSS/JS 全部內嵌在同一檔案內；圖片用 inline SVG 或 `data:` URI；**零外部網路請求**——確保離線、內網、下載後直開、Slack 轉發都能完整可用。
- 用 `file://` 直接雙擊打開就要完整可用，不依賴任何 server。
- 單檔案體積盡量控制在 2MB 以內；超出檢討是否該拆報告或把大體積資產（截圖）改成連結而非內嵌。
- **外部資料必轉義**：任何來自資料庫/使用者輸入/評論原文的文字寫進 HTML 前，必須轉義 `& < > "`（含有 `<` 的評論會直接吃掉後續版面，甚至注入腳本）。程式生成報告時走模板/轉義函式（如 Python `html.escape`），禁止手拼字串塞原文。

## 9. 視覺與樣式基線

- **寬版心佈局（2026-07-20 使用者定案）**：版心 `max-width:1600–1720px` 置中，CSS grid 兩欄＝左側導航 ~230px ＋ 主內容 `minmax(0,1fr)`（`gap:clamp(24px,3vw,48px)`）；**行長另控**——正文段落/清單另設 `max-width:74ch` 維持可讀性（寬版心是給表格、流程圖、KPI 卡用的，不是給長行文字用的）。
- 字族含 CJK fallback：`-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif`；`<html lang="zh-TW">`。
- head 加 `<meta name="color-scheme" content="light">`——報告配色以淺色設計，此宣告防止深色模式瀏覽器/外掛強制反轉配色破壞語義色（若啟用 §13a 深色模式則改為 `light dark`）。
- 語義色固定：綠＝達標/好、紅＝風險/差、琥珀＝警示；紅綠同時出現時額外用文字或圖示區分（色盲安全，不能只靠顏色傳達語意）；正文文字對比度 ≥4.5:1。
- **無障礙基線**：標題層級不跳級（h2 之下不得直接 h4）；TOC 用 `<nav>`、正文用 `<main>` 語義標籤；承載資訊的 inline SVG 加 `<title>` 或 `aria-label`（純裝飾則 `aria-hidden="true"`）。
- 數字欄一律右對齊 + `font-variant-numeric: tabular-nums`（等寬數字，多行比大小不錯位）；大數加千分位，數值附單位。
- 補 `@media print` 基本可列印樣式（隱藏導航按鈕/回頂按鈕，避免 KPI 卡片跨頁被截斷）；注意 `<details>` 未展開的內容不會被列印，重要內容勿只放摺疊區。
- 表格外層包 `overflow-x:auto` 容器，避免行動端或窄視窗橫向撐破版面。

## 10. 語言規範

- 正文一律繁體中文；技術術語、代碼、官方工具名稱保留原文英文，呼應全域 `language` 規則，不重複翻譯。

## 11. 交付前檢核（強制 · 先跑指令再人工過清單）

**第一步：可執行驗證**（機器能查的不靠肉眼）：

```bash
f=path/to/report.html
# ① 外部載入（有輸出 = ❌）
grep -nE '<(script|img|iframe|link)[^>]+(src|href)="https?://' "$f" || echo "✅ 無外部載入"
# ② 錨點 id 重複（有輸出 = ❌）——須排除 data-id 等偽命中（BSD grep 無 -P，用 python）
python3 -c "import re,sys,collections as c;ids=re.findall(r'(?<![-\w])id=\"([^\"]*)\"',open(sys.argv[1],encoding='utf-8').read());print('\n'.join(k for k,v in c.Counter(ids).items() if v>1))" "$f"
# ③ 體積（目標 ≤2MB；du 可能被 alias 改寫，用 wc 最穩）
wc -c "$f"
# ④⑤⑥ 渲染完整性：標籤配對 / 空容器 / 佔位符殘留（全部 ✅ 才可交付）
python3 - "$f" <<'EOF'
import re, sys
h = open(sys.argv[1], encoding="utf-8").read()
bad = False
for t in ["html","head","body","div","section","main","nav","aside","table","thead","tbody",
          "ul","ol","dl","details","header","footer","script","style","svg"]:
    o = len(re.findall(rf"<{t}[\s>]", h)); c = h.count(f"</{t}>")
    if o != c: bad = True; print(f"❌ ④ 標籤不配對 {t}: 開 {o} / 關 {c}（會吃掉後續版面）")
for m in re.finditer(r"<(div|nav|section|ul|ol|tbody|main)\b[^>]*>\s*</\1>", h):
    bad = True; print("❌ ⑤ 空容器（渲染成空框）:", m.group(0)[:60])
for m in re.finditer(r"⟦[^⟧]*⟧", h):
    bad = True; print("❌ ⑥ 佔位符未替換:", m.group(0))
print("✅ ④⑤⑥ 渲染完整性通過" if not bad else "→ 修正後重跑")
EOF
```

**第二步：人工清單**（機器查不了的）：

- [ ] 檔名 kebab-case，符合 `{主題}-{類型}.html`
- [ ] TL;DR / KPI 卡在首屏
- [ ] 每個 `<h2>` 區塊第一元素是結論，不是原始數據
- [ ] 所有 `<h1>`–`<h4>` 有穩定語義化 id + 🔗 複製連結；左側導航欄為混合式（靜態連結 + JS 僅做高亮）
- [ ] 寬版心＋左側導航欄到位（章節 <4 短頁可省側欄）；流程圖原尺寸、圖內文字可讀，超寬圖僅在圖卡內橫捲
- [ ] 無 JS 環境不留空框：JS 增強元素皆有靜態內容或預設 `hidden`
- [ ] 外部資料（評論原文等）已經過 HTML 轉義
- [ ] 標題層級不跳級；生成資訊 footer 齊備（時間+快照+樣本量+產生方式）
- [ ] 資料為空的區塊顯示空狀態文字，非空白容器
- [ ] **雙環境檢視**：① 正常瀏覽器 `file://` 直開——錨點跳轉、`:target` 高亮、複製按鈕全部可用；② 無 JS 檢視器（聊天側欄預覽等）——內容完整、無空框、無破版
- [ ] **側欄連動 100%**：捲到每節「中段」側欄亮的就是該節（長章節不殘留前後節）；點擊任一連結立即高亮該項；捲到頁底最後一節亮
- [ ] **一鍵複製**：所有 `pre`／長文本區塊右上角有複製按鈕，點擊有「✓ 已複製」回饋、複製內容不含按鈕文字；按鈕由 JS 生成（無 JS 環境零殘骸）
- [ ] 關鍵數字都附口徑說明

## 12. 基礎骨架（供快速起手）

新報告可直接以此為底，套用本檔 §3 的錨點 CSS/JS 與 §9 的視覺基線。**佔位符一律用 `⟦…⟧` 標記**——填完內容後 §11 的檢核 ⑥ 一條 regex 即可保證零殘留：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>⟦報告標題⟧</title>
<style>
  body{font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;
       margin:0;color:#374151;line-height:1.7;font-size:15px;background:#fdfdfe}
  /* §9 寬版心 + 左側導航（2026-07-20 定案） */
  .shell{max-width:1700px;margin:0 auto;padding:0 clamp(16px,3vw,40px);
         display:grid;grid-template-columns:230px minmax(0,1fr);gap:clamp(24px,3vw,48px)}
  .side{position:sticky;top:0;align-self:start;height:100dvh;overflow-y:auto;
        padding:1.5rem 4px 2rem;border-right:1px solid #e6ebf1;font-size:.9rem}
  .side nav a{display:block;padding:4px 10px;border-radius:7px;color:#5a6b7a;
        text-decoration:none;font-size:.85rem;border-left:2px solid transparent}
  .side nav a:hover{background:#f4f8fc;color:#374151}
  .side nav a.on{color:#3b6ea5;background:#eaf2fa;border-left-color:#3b6ea5;font-weight:600}
  main{min-width:0;padding:1.6rem 0 4rem}
  main p,main li{max-width:74ch}  /* 行長可讀性：寬版心給表格/圖用，不給長行文字 */
  h1{font-size:1.6rem;color:#3b6ea5;border-bottom:2px solid #cfe0f0;
     padding-bottom:.4rem;font-weight:600}
  h2{font-size:1.2rem;margin-top:2rem;color:#5a86b3;border-left:3px solid #b8d4ea;
     padding-left:.6rem}
  .tldr{background:#f4f8fc;border-left:3px solid #3b6ea5;border-radius:6px;
        padding:1rem 1.2rem;margin:1rem 0}
  .callout{background:#f7fafd;border:1px dashed #cfe0f0;border-radius:8px;
           padding:.7rem 1rem;margin:.6rem 0;font-size:14.5px}
  .kpis{display:flex;flex-wrap:wrap;gap:.8rem;margin:1.2rem 0}
  .kpi{flex:1 1 180px;background:#f7fafd;border:1px solid #e6ebf1;
       border-radius:10px;padding:.9rem 1rem}
  .kpi-v{font-size:1.7rem;font-weight:700;color:#3b6ea5;line-height:1.2}
  .kpi-k{font-size:.85rem;color:#5a6b7a;margin-top:.2rem;font-weight:600}
  /* §5 圖卡：原尺寸渲染，超寬橫捲不縮小 */
  .figure{border:1px solid #e0e6ec;border-radius:12px;background:#f4f6f8;
          padding:1rem;overflow-x:auto;margin:1rem 0}
  .figure svg{max-width:none;height:auto}
  .table-wrap{overflow-x:auto}
  table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:14px}
  th,td{border:1px solid #e6ebf1;padding:.45rem .6rem;text-align:left}
  th{background:#f4f8fc;font-weight:600;color:#4b6b8a;position:sticky;top:0}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid #eef1f4;
         font-size:12.5px;color:#8a97a5}
  @media (max-width:900px){.shell{grid-template-columns:1fr}
    .side{position:static;height:auto;border-right:0;border-bottom:1px solid #e6ebf1}}
  @media print{ .anchor-link,.side{display:none} .shell{display:block} }
</style>
</head>
<body>
<div class="shell">
<aside class="side">
  <strong>⟦報告簡稱⟧</strong>
  <nav>⟦靜態章節連結，與各 h2 id 一一對應（§4 混合式，JS 僅做高亮）⟧</nav>
</aside>
<main>
<h1 id="report-title">⟦報告標題⟧</h1>
<div class="tldr"><strong>結論先行：</strong>⟦3–5 條核心結論，可前置 🟢/🔴/🟡 狀態標籤⟧</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-v">⟦數值⟧</div><div class="kpi-k">⟦指標名⟧</div></div>
</div>
<h2 id="⟦section-anchor⟧">⟦章節標題⟧</h2>
<p class="callout">⟦該節結論⟧</p>
<footer>生成：⟦時間 Asia/Taipei⟧ ｜ 數據快照：⟦時間⟧ ｜ 樣本：⟦N 筆⟧ ｜ 產生方式：⟦腳本/指令⟧</footer>
</main>
</div>
<!-- §3 錨點 script 與 §4 scrollspy script 放這裡（</body> 前） -->
</body>
</html>
```

## 13. 選配增強（預設不啟用 · 符合觸發條件才加）

預設報告 §1–§12 已足夠；以下兩項**僅在對應場景出現時啟用**，不無腦全加（每加一項都是體積與測試面的成本）。啟用後同樣要過 §11 檢核。

### 13a. 深色模式（觸發：受眾主要在深色環境閱讀，或使用者點名要）

- 作法：顏色抽成 CSS variables，`@media (prefers-color-scheme: dark)` 覆蓋一套深色值；head 的 `color-scheme` 同步改 `content="light dark"`。
- 兩套配色都要過 §9 的對比度與語義色檢查（深色底下綠/紅需換更亮的色階，否則對比不足）。

```css
:root{--bg:#fdfdfe;--fg:#374151;--accent:#3b6ea5;--line:#e6ebf1;--panel:#f7fafd}
@media (prefers-color-scheme: dark){
  :root{--bg:#16181d;--fg:#c9d1d9;--accent:#7aa7d4;--line:#2d333b;--panel:#1e232a}
}
body{background:var(--bg);color:var(--fg)}  /* 其餘規則同步改用 var() */
```

### 13b. 表格點擊排序（觸發：單表 ≥15 列、且讀者確實需要按不同欄位重排比較）

表格加 `class="sortable"`，零依賴、數字/文字自動判別（含千分位與 `%`）：

```html
<script>
  document.querySelectorAll('table.sortable th').forEach(function (th, i) {
    th.style.cursor = 'pointer'; th.title = '點擊排序';
    th.onclick = function () {
      var tb = th.closest('table').tBodies[0];
      var asc = th.dataset.asc !== '1'; th.dataset.asc = asc ? '1' : '0';
      Array.prototype.slice.call(tb.rows).sort(function (a, b) {
        var x = a.cells[i].textContent.trim(), y = b.cells[i].textContent.trim();
        var nx = parseFloat(x.replace(/[,%]/g, '')), ny = parseFloat(y.replace(/[,%]/g, ''));
        var r = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : x.localeCompare(y, 'zh-Hant');
        return asc ? r : -r;
      }).forEach(function (row) { tb.appendChild(row); });
    };
  });
</script>
```

> （原 13c「Scrollspy 側欄目錄」已於 2026-07-20 依使用者定案升級為**預設佈局**，內容併入 §4／§9／§12，本節退役。）

</html_report>
