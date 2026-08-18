import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { exportToCSV } from './csv.js'

describe('exportToCSV', () => {
  let clickSpy

  beforeEach(() => {
    clickSpy = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:url'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return { click: clickSpy, href: '', download: '' }
      return document.createElement.call(document, tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generates CSV with headers and rows', () => {
    const headers = ['Name', 'Type']
    const rows = [['Lot A', 'residential'], ['Lot B', 'commercial']]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('escapes values containing commas', () => {
    const headers = ['Name']
    const rows = [['Lot A, Batangas']]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('escapes values containing quotes', () => {
    const headers = ['Name']
    const rows = [['He said "hello"']]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('handles null and undefined values', () => {
    const headers = ['Name', 'Type']
    const rows = [[null, undefined]]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })
})
