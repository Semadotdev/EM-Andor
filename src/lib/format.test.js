import { describe, expect, it } from 'vitest'
import { formatPrice } from './format.js'

describe('formatPrice', () => {
  it('formats a number with peso sign and thousands separators', () => {
    expect(formatPrice(1500000)).toBe('₱ 1,500,000')
  })

  it('formats a numeric string', () => {
    expect(formatPrice('1234567.5')).toBe('₱ 1,234,567.5')
  })

  it('returns null for empty string', () => {
    expect(formatPrice('')).toBeNull()
  })

  it('returns null for null and undefined', () => {
    expect(formatPrice(null)).toBeNull()
    expect(formatPrice(undefined)).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(formatPrice('abc')).toBeNull()
  })
})
