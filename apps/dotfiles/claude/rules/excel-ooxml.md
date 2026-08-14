---
name: excel-ooxml
description: Excel(.xlsx) 全域規範 — 資料表版面慣例（雙層表頭/配色/欄位附註/固定列高）、工具選擇決策樹（openpyxl vs zip 手術 vs Apps Script）、讀取與寫入紅線（樞紐/圖表保護、硬限制、精度）、OOXML 手術指南（加分頁/刪欄/附註）、驗證交付流程、Google Sheets 互通坑。產出或改動 .xlsx / 試算表時載入。
---

<excel_ooxml>

# A. 資料表預設版面慣例（產表時一律套用，除非使用者另有指定）

凡產出「多欄位資料表」型的 .xlsx / 工作表（匯出、抽樣、交付表），預設按以下版面：

1. **第 1 列＝聚合分類表頭**：欄位按語義分組（如 A 類基本資訊 / B 類交易資訊 / C 類關聯方資訊 / D 類長文紀錄），每組一個**合併儲存格**；後補的特殊區塊（AI 產出欄、待驗證欄）用紅色標示與人工/DB 欄位的分界。
   ⚠️ **合併範圍禁止跨越凍結欄邊界**：被凍結的主鍵欄（如 A 欄）第 1 列儲存格保持獨立不併入任何分組合併（可同底色但不合併）——Google Sheets 對跨凍結線的合併直接報錯（無法合并已冻结和非冻结的列）。
2. **第 2 列＝具體欄位名**：機器可讀欄位名（snake_case 保留原樣，不翻譯）；**每個欄位名儲存格附「附註」(Note)**：欄位語義、資料來源（DB/SQL、AI 判定、計算）、參照文件——懸停即見不佔版面（做法見 §E7）。
3. **表頭配色標準**（兩列皆粗體白字置中；既有表已有配色時沿用，不強改）：
   - 第 1 列分組色按序輪用深色系：藍 `FF2E75B6` → 綠 `FF548235` → 芥末黃 `FFBF8F00` → 橘 `FFC55A11` → 灰 `FF7F7F7F`；**紅 `FFC00000` 保留給特殊區塊專用**，不進輪替
   - 第 2 列**全列統一**深綠 `FF538135`，不隨分組變色——分組區隔交給第 1 列
   - 資料列白底不刷色；標狀態只對單一儲存格上色，不整列刷
4. **列高固定兩行文字，不被長內容撐開**：資料列 `ht` 鎖約兩行高（12pt 字型約 30–40pt；有既有表沿用其值，如 39.75pt）＋ `customHeight="1"`；全欄 `wrapText`，長文欄（對話全文、JSON）固定高度內換行、超出視覺裁切，資料完整不受影響（機制見 §E4）。
5. **凍結窗格**：凍結前兩列（`<pane ySplit="2" topLeftCell="A3" state="frozen"/>`）；有主鍵欄可加 `xSplit="1"`，前提是第 1 列合併全部從 B1 之後開始（見第 1 條）。不凍結欄時**省略 xSplit**，不寫 `xSplit="0"`。
6. **自動篩選**：掛第 2 列、涵蓋全欄（`A2:最後欄最後列`），聚合表頭列不入篩選範圍。
7. **欄寬依內容型態**：短代碼/旗標 10–14、名稱/標籤 15–22、時間戳 14–20、長文欄 60±（一屏可讀即可）；欄名長於內容時以欄名為準，表頭必須完整可見。
8. **資料型別保真**：數字寫 `<v>` 不轉字串、文字用 `t="inlineStr"`、日期時間統一 `YYYY-MM-DD HH:MM:SS` 字串（除非要參與日期運算）；空值給空儲存格不給空字串。
9. **衍生表與母表同構**：抽樣/子集分頁沿用母表全套版面（分組表頭、欄序、欄寬、樣式、附註）；新增/刪除欄位時**所有相關分頁同步**套用，不留半套。

# B. 工具選擇決策樹（動手前先走一遍）

```
目標是雲端 Google Sheet 本體、要立即生效？
├─ 是 → Apps Script + Monaco setValue 手法（§G3），不繞本地檔案
└─ 否（本地 .xlsx）
   ├─ 只讀取/分析/抽樣 → openpyxl read_only=True + data_only=True（§C）
   ├─ 要寫入，檔案「乾淨」（無樞紐/圖表/圖片/巨集）→ openpyxl 正常模式直接改（最省事）
   ├─ 要寫入，檔案含樞紐分析表/圖表/圖片 → OOXML zip 手術（§E），不做 openpyxl 整檔 round-trip
   └─ openpyxl 正常模式直接 ParseError（樞紐 cache 損壞等）→ 只剩 zip 手術一條路（§E）
```

- **含樞紐/圖表/圖片的檔案禁止 openpyxl round-trip 存檔**：openpyxl 讀舊檔再 save 會丟失圖表/圖片/形狀；樞紐遇損壞 cache 直接開不了檔。這類檔案一律 zip 手術，只動要動的 part。
- **禁止**為了讓 openpyxl 能開檔而先移除 pivot cache——等於砍掉使用者活的樞紐分析表，不可回復。
- 純大量數據分析用 pandas（`pd.read_excel`），但 pandas 寫出的 xlsx 無版面，交付表仍要按 §A 補版面或改走 openpyxl/zip 路徑。

# C. 讀取規範

1. **一律 `read_only=True, data_only=True`** 起手：read_only 不解析 pivot cache（損壞也能讀）、省記憶體；data_only 拿公式運算後的快取值而非公式字串（檔案從未被 Excel/Sheets 算過時會是 None，屬資料面事實，不是 bug）。
2. **read_only 模式 `ws.max_row` 可能是 None**（Google Sheets 匯出的檔常無 dimension 資訊）——列數一律 `iter_rows` 實際數，不依賴 max_row/max_column。
3. **雙層表頭辨識**：第 1 列多為分組表頭（大量 None + 少數分組名）、第 2 列才是欄位名、資料從第 3 列起。讀表先印前 3 列確認結構再動手，不假設單層表頭。
4. 過濾空列用「主鍵欄非 None」判斷，不用整列全空判斷（部分欄位常態性空值）。
5. 大檔（數十 MB / 數萬列）不要一次 `list()` 整表；iter_rows 邊掃邊聚合（分組、計數）後再定策略。

# D. 寫入紅線與硬限制

1. **單儲存格文字上限 32,767 字元**（Excel 硬限制）：寫入前檢查，超限截斷並在尾端加明確標記（如 `...[已截斷]`），同時回報截斷了幾格；**Google Sheets 更嚴：單格 50,000 字元、整表 1,000 萬儲存格**——交付對象是 Sheets 時以 Sheets 限制為準。
2. **數字精度 15 位有效數字**：超過 15 位的長數字 ID（訂單號、條碼）必須以文字寫入（inlineStr），用 `<v>` 會被截尾成 0——匯出前檢查 ID 類欄位位數。
3. **分頁名限制**：≤31 字元，禁 `: \ / ? * [ ]`，首尾不可為 `'`；超名先截斷或改寫，不要讓存檔時才炸。
4. **公式注入防護**：以 `=` `+` `-` `@` 開頭的使用者文字，經 CSV 匯入或直接貼上會被當公式執行；xlsx 內用 `t="inlineStr"` 寫入即為純文字、天然安全——**永遠不要**為省事把不信任文字拼進 CSV 給 Sheets 匯入。
5. **非法 XML 字元清洗**：使用者資料（對話紀錄常見）可能含控制字元 `\x00-\x08\x0b\x0c\x0e-\x1f`，寫入 XML 前先 regex 清除，否則產出的檔打不開。
6. **覆蓋既有檔前必做 `.bak` 備份**（同目錄 `.bak` 後綴即可，本地可逆操作不必先問）；改動一律先寫暫存路徑、驗證全過（§F）才 `mv` 回正式路徑。
7. **目標檔可能正被試算表軟體開著**：留意同目錄 `.~` / `~$` 開頭的鎖檔；覆蓋後提醒使用者「舊視窗先關閉不儲存再重開」，避免舊視窗回存把改動蓋掉。

# E. OOXML zip 手術指南

xlsx 本質是 zip 包。手術原則：**只重寫明確要動的 part，其餘 `zout.writestr(item, zin.read(name))` 逐位元組照抄**。

## E1. 關鍵 part 速查

| Part | 作用 |
|---|---|
| `xl/workbook.xml` | 分頁清單 `<sheets><sheet name="" sheetId="" r:id=""/></sheets>` |
| `xl/_rels/workbook.xml.rels` | r:id 對應實際檔案路徑 |
| `[Content_Types].xml` | part 的 MIME 宣告，**新增 part 必須同步加 `<Override>`** |
| `xl/worksheets/sheetN.xml` | 分頁本體；cell：`<c r="A1" s="樣式id"><v>值</v></c>` 或 `<c r="A1" t="inlineStr"><is><t>文字</t></is></c>` |
| `xl/styles.xml` | fonts/fills/borders/cellXfs 共用樣式表；cell 的 `s="N"` 索引 cellXfs 第 N 項（0-based） |
| `xl/sharedStrings.xml` | 共用字串表；用 `t="inlineStr"` 可完全繞過不碰它 |
| `xl/worksheets/_rels/sheetN.xml.rels` | 分頁專屬關聯（drawing、comments、vmlDrawing） |
| `xl/comments{N}.xml` + `xl/drawings/vmlDrawing{N}.vml` | 儲存格附註的兩個必要 part |

## E2. 新增分頁 5 步

① workbook.xml 的 `</sheets>` 前插 `<sheet state="visible" name="新名" sheetId="最大值+1" r:id="自訂新id"/>` → ② workbook.xml.rels 加對應 Relationship（Type=worksheet）→ ③ [Content_Types].xml 加 worksheet Override → ④ 寫全新 sheetN.xml（文字 inlineStr、數字 `<v>`、日期格式化成字串）→ ⑤ 其餘 part 原封照抄。

## E3. 樣式重用

- 先讀既有 `<cellXfs>`，**能重用既有 style id 就重用**（分組表頭的首格/中段/尾格三段式模式可整組借用，只有變色的首格需要新樣式）。
- 需要新樣式：**複製既有 `<xf>` 只改目標屬性**，append 到 cellXfs 尾端、`count` +1，新 index=原 count 值。禁止每格新建 xf。
- `<alignment>` 可能本來就沒有 `wrapText` 屬性（預設 0），要用「插入屬性」處理，不能假設有屬性可正則替換。

## E4. 換行但不撐高列高

自動列高在 `wrapText="1"` 時會被內容撐開，無法對單一欄位排除。解法＝該列 `<row ht="固定值" customHeight="1">` 鎖列高＋欄位照開 wrapText：固定高度內換行顯示、超出視覺裁切、資料完整。高度取「一般欄位兩行」所需，不用最長欄反推；原表已有固定列高就沿用同值。

## E5. 大量列的欄位刪除/位移（數萬列）

不用 openpyxl 的 delete_cols/insert_cols（檔案打不開時根本沒這條路）。regex 對整份 sheetN.xml 做 cell 級替換：

```python
CELL_RE = re.compile(r'<c r="([A-Z]+)(\d+)"[^>]*?(?:/>|>.*?</c>)', re.DOTALL)  # DOTALL 防內容含換行斷比對
def shift_cb(m):
    col_letters, row_num = m.group(1), m.group(2)
    col_idx = column_index_from_string(col_letters)
    if col_idx == DELETE_AT: return ''
    if col_idx > DELETE_AT:
        return m.group(0).replace(f'r="{col_letters}{row_num}"',
                                  f'r="{get_column_letter(col_idx-1)}{row_num}"', 1)
    return m.group(0)
```

⚠️ 踩坑：用「style 值」而非「欄位序號」決定改不改時，regex 沒限定 row 範圍會把**表頭列的同 style 值一併誤改**——判斷條件必須含 row 範圍或其他區辨特徵，不能只認 style id。

## E6. 結構元素連動（刪增欄位後全部要同步）

`<cols>`（欄寬定義位移）、`<dimension>`（原檔有才改；Google 匯出檔常沒有，不強加）、`<mergeCells>`（合併區間位移/重框）、`<autoFilter>`（範圍延伸/縮短）。`<drawing>`/`<legacyDrawing>` 浮動元素絕對定位，可略過。

## E7. 儲存格附註 (Note)

Google Sheets「附註」＝ xlsx legacy `<comments>` + VML，雙向互通。**不要用** Excel 365 threaded comments（`xl/threadedComments/`，Sheets 不顯示為附註）。5 步佈線：

① `xl/comments{N}.xml`：`<comments><authors><author>備註</author></authors><commentList><comment ref="A2" authorId="0"><text><r><t xml:space="preserve">內容</t></r></text></comment>…</commentList></comments>`
② `xl/drawings/vmlDrawing{N}.vml`：每附註一個 `<v:shape>`，`<x:Row>`/`<x:Column>` **0-based** 座標，`visibility:hidden` 預設收合
③ 分頁 rels 加兩條 Relationship（comments + vmlDrawing）；沒有 rels 檔就新建
④ sheetN.xml 加 `<legacyDrawing r:id="..."/>`（在 `<drawing>` 之後、`</worksheet>` 之前）
⑤ [Content_Types].xml 加 comments Override ＋ vml 的 `<Default Extension="vml" .../>`（整檔一條就夠）

# F. 驗證與交付流程（每次改完，不可省略）

1. **Well-formedness**：改過的 XML 片段逐一 parse 驗證。⚠️ 來源是外部/不信任檔案時用 `defusedxml.ElementTree`（stdlib parser 不擋 XXE / billion-laughs）；parse 自己剛生成的 XML 用 stdlib 即可。
2. **內容抽查**：openpyxl read_only 重開整檔——分頁清單、各分頁列數/欄數、表頭內容；欄位刪除/位移後**務必**抽幾列驗「值與欄名還對得上」（錯位是最隱蔽的災難）。
3. **Byte-diff 防線**：與改動前備份逐 part 比對，「不該動的 part」必須完全位元組相同，只有預期改動的 part 允許 diff——防止誤傷 pivot cache / sharedStrings / drawings 的最後防線。
4. **量化核對**：抽樣/分組類任務，實際筆數與目標配額逐組核對輸出（母體數、目標數、實抽數三欄），總數用工具驗算不心算。
5. **可重現性**：隨機抽樣寫死 seed 並在回報中記錄；同 seed 同輸入可完整重現同一份樣本。
6. 全過才 `mv` 覆蓋正式路徑（§D6 備份前提）；交付時說明「改了什麼、驗了什麼、什麼沒動」。

# G. Google Sheets 互通

1. **雲端檔案兩種身分**：Drive 上的原生 Google Sheet（mimeType `application/vnd.google-apps.spreadsheet`）vs 上傳的 .xlsx（`...openxmlformats...sheet`）。原生 Sheet 要 export 轉檔才有 xlsx；上傳的 xlsx 是二進位檔直接下載。**MCP 下載/匯出上限約 10MB**，超限就請使用者本機下載後給路徑，不要反覆嘗試。
2. **回存正規化**：檔案經 Google Sheets 開啟回存後，XML 會被重寫正規化（pane 屬性、selection、style 重排）——不要假設自己上次寫的 XML 原樣還在，每次手術前重新讀當前檔案狀態；也因此 byte-diff 基準必須是「本次手術前」的備份，不是更早的版本。
3. **線上直改**（雲端表要立即生效、他人正在看）：走「綁定式 Apps Script + 頁面注入 Monaco setValue」手法（`SpreadsheetApp.getActiveSpreadsheet()` 免額外 OAuth；剪貼簿/逐格輸入皆不可靠）。⚠️ 注入 Monaco 編輯器須用 `setValue`，直接改 DOM textarea 不會觸發 Apps Script 的變更偵測。
4. **本地改 vs 線上改的選擇**：改完要使用者重新上傳/匯入 → 本地 xlsx 手術；要立即生效且保留雲端協作狀態 → 線上路徑。混用會產生兩份分歧的真相，動手前先確認哪份是 SSOT。

</excel_ooxml>
