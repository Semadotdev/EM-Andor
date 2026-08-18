export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return `₱ ${num.toLocaleString('en-PH')}`
}

export function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const now = Date.now()
  const then = new Date(dateString).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = now - then
  if (diffMs < 0) return 'just now'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}
