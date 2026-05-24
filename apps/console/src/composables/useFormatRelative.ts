export function formatRelative(ts: string | null | undefined): string {
  if (!ts)
    return '從未更新'
  const date = new Date(ts)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1)
    return '剛剛'
  if (diffMin < 60)
    return `${diffMin} 分鐘前`
  if (diffHour < 24)
    return `${diffHour} 小時前`
  if (diffDay === 1)
    return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDay < 7)
    return `${diffDay} 天前`
  return date.toLocaleDateString('zh-TW')
}
