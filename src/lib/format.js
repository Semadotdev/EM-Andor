export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return `₱ ${num.toLocaleString('en-PH')}`
}
