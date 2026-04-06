/**
 * commons 可用指令定義
 * 新增指令：在此加一行 + root package.json 註冊 "c:xxx"
 */
export default {
  sync: '列出 AI 來源與狀態',
  validate: '驗證資源結構 + 安全檢查',
};

/**
 * 特殊指令（帶額外參數）
 */
export const aliases = {
  'sync:select': { cmd: 'sync', args: '--select', desc: '互動式選擇同步' },
  'sync:all': { cmd: 'sync', args: '--all', desc: '同步全部 7 個來源' },
};
