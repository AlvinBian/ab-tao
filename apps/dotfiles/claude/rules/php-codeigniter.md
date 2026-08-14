---
name: php-codeigniter
description: PHP CodeIgniter controller 註解規範 + internal API 搬移規範（KKday b2c-web 類專案）。
paths:
  - "application/**/*.php"
  - "src/**/*.php"
---

## PHP Controller API 註解規範

適用：`application/controllers/**/*.php` 所有公開方法。

每個 public API method 上方加 PHPDoc `/** ... */`：第一行功能描述，空行後寫 HTTP Method + Endpoint。

```php
/**
 * 取得使用者基本資料
 *
 * GET /user/profile
 */
public function profile() { ... }
```

## Internal API 搬移規範

目標目錄：`application/controllers/api/internal/`

- function 命名去除 `ajax_` 前綴（如 `get_xxx`、`create_xxx`）
- Response 統一 `$this->response($status_code, $message, $data)`；status_code 用標準 HTTP code（200 / 400 / 500）
- 若 `$response` 已含 `data` 層，直接指派 `$response['data']`，避免 `data.data`
- 自訂 Exception（如 `ApiInternalMerchantException`），不直接 catch `Exception`
- 取 `lang_ui` 用 `$this->session->userdata('lang_ui')`，不用 `$this->load->get_var('lang_ui')`
- 無 session 驗證的原始邏輯不強加 session check
