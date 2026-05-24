/**
 * 驗證請求來自信任的 localhost 來源
 * 所有 mutation endpoint（PATCH/POST/DELETE/PUT）呼叫此函式
 * 失敗時 throw TrustedOriginError（呼叫方回傳 403）
 */
export class TrustedOriginError extends Error {
  constructor(origin) {
    super(`不受信任的來源：${origin || '(無 Origin)'}`)
    this.code = 'UNTRUSTED_ORIGIN'
    this.status = 403
  }
}

export function assertTrustedOrigin(req) {
  const origin = req.headers.origin ?? ''
  // 允許無 Origin（同源請求、curl 測試）或 localhost 任意端口
  if (!origin || /^http:\/\/localhost:\d+$/.test(origin))
    return
  throw new TrustedOriginError(origin)
}
