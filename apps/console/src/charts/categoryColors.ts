export const CATEGORY_COLORS: Record<string, string> = {
  '前端框架': '#409EFF',
  '後端框架': '#67C23A',
  '狀態管理': '#7B68EE',
  'UI 元件庫': '#5470c6',
  'CSS 與樣式': '#9370DB',
  'HTTP 與 API': '#20B2AA',
  '測試框架': '#B0C4DE',
  '建構工具': '#E6A23C',
  '資料庫': '#909399',
  '容器化': '#3CB371',
  '基礎設施': '#FF8C00',
  '監控與追蹤': '#DC143C',
  '表單驗證': '#FFB6C1',
  '國際化': '#FFA500',
  '即時通訊': '#00CED1',
  '第三方整合': '#BA55D3',
  '安全與認證': '#F56C6C',
  '工具函式': '#A0522D',
  'CLI 工具': '#708090',
  '多媒體': '#FF69B4',
  '語言': '#1abc9c',
  '其他': '#C0C0C0',
  'uncategorized': '#C0C0C0',
}

export function getCategoryColor(cat: string): string {
  return (
    CATEGORY_COLORS[cat] ?? CATEGORY_COLORS[cat.toLowerCase()] ?? '#909399'
  )
}
