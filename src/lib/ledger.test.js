import { describe, expect, it } from 'vitest'
import { buildLedger, ledgerCsvRows, monthlyAmortization } from './ledger.js'

describe('ledger', () => {
  describe('buildLedger', () => {
    it('returns the TCP as the balance for an empty ledger', () => {
      const ledger = buildLedger([], 1500000)

      expect(ledger.rows).toEqual([])
      expect(ledger.totalAmount).toBe(0)
      expect(ledger.totalPrincipal).toBe(0)
      expect(ledger.remainingBalance).toBe(1500000)
    })

    it('defaults to a zero balance without payments or TCP', () => {
      const ledger = buildLedger()

      expect(ledger.rows).toEqual([])
      expect(ledger.remainingBalance).toBe(0)
    })

    it('applies a single payment to the balance', () => {
      const ledger = buildLedger(
        [{ id: 'pay1', entry_date: '2026-01-05', or_number: 'OR-1', amount: 5000, surcharge: 0, interest: 0 }],
        20000,
      )

      expect(ledger.rows).toEqual([
        expect.objectContaining({ id: 'pay1', principal: 5000, balance: 15000 }),
      ])
      expect(ledger.totalAmount).toBe(5000)
      expect(ledger.totalPrincipal).toBe(5000)
      expect(ledger.remainingBalance).toBe(15000)
    })

    it('runs the balance down across multiple payments', () => {
      const ledger = buildLedger(
        [
          { id: 'pay1', entry_date: '2026-01-05', amount: 5000 },
          { id: 'pay2', entry_date: '2026-02-05', amount: 3000 },
          { id: 'pay3', entry_date: '2026-03-05', amount: 2000 },
        ],
        20000,
      )

      expect(ledger.rows.map((row) => row.balance)).toEqual([15000, 12000, 10000])
      expect(ledger.totalAmount).toBe(10000)
      expect(ledger.totalPrincipal).toBe(10000)
      expect(ledger.remainingBalance).toBe(10000)
    })

    it('sorts out-of-order payments chronologically before running the balance', () => {
      const ledger = buildLedger(
        [
          { id: 'pay3', entry_date: '2026-03-05', amount: 1000, created_at: '2026-03-05T00:00:00Z' },
          { id: 'pay1', entry_date: '2026-01-05', amount: 5000, created_at: '2026-01-05T00:00:00Z' },
          { id: 'pay2', entry_date: '2026-02-05', amount: 3000, created_at: '2026-02-05T00:00:00Z' },
        ],
        10000,
      )

      expect(ledger.rows.map((row) => row.id)).toEqual(['pay1', 'pay2', 'pay3'])
      expect(ledger.rows.map((row) => row.balance)).toEqual([5000, 2000, 1000])
    })

    it('breaks same-date ties by created_at', () => {
      const ledger = buildLedger(
        [
          { id: 'late', entry_date: '2026-01-05', amount: 1000, created_at: '2026-01-06T00:00:00Z' },
          { id: 'early', entry_date: '2026-01-05', amount: 1000, created_at: '2026-01-05T00:00:00Z' },
        ],
        5000,
      )

      expect(ledger.rows.map((row) => row.id)).toEqual(['early', 'late'])
    })

    it('excludes surcharge and interest from principal and raises the balance when they exceed the amount', () => {
      const ledger = buildLedger([{ id: 'pay1', entry_date: '2026-01-05', amount: 1000, surcharge: 800, interest: 500 }], 10000)

      expect(ledger.rows[0].principal).toBe(-300)
      expect(ledger.rows[0].balance).toBe(10300)
      expect(ledger.totalPrincipal).toBe(-300)
      expect(ledger.remainingBalance).toBe(10300)
    })

    it('rounds principal and balance to centavos', () => {
      const ledger = buildLedger(
        [{ id: 'pay1', entry_date: '2026-01-05', amount: 0.3, surcharge: 0.1, interest: 0.1 }],
        10,
      )

      expect(ledger.rows[0].principal).toBe(0.1)
      expect(ledger.rows[0].balance).toBe(9.9)
    })

    it('rounds fractional amounts to the nearest centavo', () => {
      const ledger = buildLedger(
        [{ id: 'pay1', entry_date: '2026-01-05', amount: 333.335, surcharge: 0.005, interest: 0.001 }],
        1000,
      )

      expect(ledger.rows[0].principal).toBe(333.33)
      expect(ledger.rows[0].balance).toBe(666.67)
    })

    it('treats missing amounts as zero without mutating the input', () => {
      const payments = [{ id: 'pay1', entry_date: '2026-01-05' }]
      const ledger = buildLedger(payments, 100)

      expect(ledger.rows[0].principal).toBe(0)
      expect(ledger.rows[0].balance).toBe(100)
      expect(payments[0]).not.toHaveProperty('balance')
    })
  })

  describe('monthlyAmortization', () => {
    it('divides the balance evenly for 12-36 month terms without interest', () => {
      expect(monthlyAmortization(500000, 100000, '12')).toBe(33333.33)
      expect(monthlyAmortization(500000, 100000, '24')).toBe(16666.67)
      expect(monthlyAmortization(500000, 100000, '36')).toBe(11111.11)
    })

    it('applies a 12% diminishing annuity to 48- and 60-month terms', () => {
      expect(monthlyAmortization(500000, 100000, '48')).toBe(10533.53)
      expect(monthlyAmortization(500000, 100000, '60')).toBe(8897.78)
    })

    it('returns zero when the downpayment covers the whole TCP', () => {
      expect(monthlyAmortization(500000, 500000, '24')).toBe(0)
      expect(monthlyAmortization(500000, 600000, '48')).toBe(0)
    })

    it('returns zero without terms or a balance', () => {
      expect(monthlyAmortization(500000, 100000, '')).toBe(0)
      expect(monthlyAmortization(500000, 100000, null)).toBe(0)
    })
  })

  describe('ledgerCsvRows', () => {
    it('maps ledger rows to CSV columns', () => {
      const ledger = buildLedger(
        [
          {
            entry_date: '2026-01-05',
            or_number: 'OR-1',
            amount: 5000,
            surcharge: 100,
            interest: 50,
            remarks: 'first payment',
          },
        ],
        20000,
      )

      expect(ledgerCsvRows(ledger)).toEqual([['2026-01-05', 'OR-1', 5000, 100, 50, 4850, 15150, 'first payment']])
    })

    it('defaults missing optional text fields to empty strings', () => {
      const ledger = buildLedger([{ entry_date: '2026-02-01', amount: 1000, surcharge: 0, interest: 0 }], 5000)

      expect(ledgerCsvRows(ledger)).toEqual([['2026-02-01', '', 1000, 0, 0, 1000, 4000, '']])
    })
  })
})
