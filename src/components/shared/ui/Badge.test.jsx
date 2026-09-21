import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge, { statusTone } from './Badge.jsx'

describe('Badge', () => {
  it('renders its children with the shared badge classes', () => {
    render(<Badge>Draft</Badge>)

    const badge = screen.getByText('Draft')
    expect(badge).toHaveClass('inline-flex', 'rounded-full', 'text-xs', 'font-bold')
  })

  it.each([
    ['green', 'bg-green-100'],
    ['yellow', 'bg-yellow-100'],
    ['red', 'bg-red-100'],
    ['blue', 'bg-blue-100'],
    ['gray', 'bg-gray-100'],
    ['gold', 'bg-gold/20'],
    ['brand', 'bg-brand/10'],
  ])('applies the %s tone', (tone, expected) => {
    render(<Badge tone={tone}>{tone}</Badge>)

    expect(screen.getByText(tone)).toHaveClass(expected)
  })

  it('falls back to the gray tone for unknown tones', () => {
    render(<Badge tone="purple">Unknown</Badge>)

    expect(screen.getByText('Unknown')).toHaveClass('bg-gray-100')
  })

  it.each([
    ['available', 'green'],
    ['active', 'green'],
    ['reserved', 'yellow'],
    ['sold', 'red'],
    ['inactive', 'red'],
    ['other', 'gray'],
    [undefined, 'gray'],
  ])('maps status %s to the %s tone', (status, tone) => {
    expect(statusTone(status)).toBe(tone)
  })
})
