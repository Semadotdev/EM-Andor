const round2 = (n) => Math.round(n * 100) / 100

export const PAYMENT_TERMS = [
  { value: '12', label: '12 months (no interest)' },
  { value: '24', label: '24 months (no interest)' },
  { value: '36', label: '36 months (no interest)' },
  { value: '48', label: '48 months (12% diminishing)' },
  { value: '60', label: '60 months (12% diminishing)' },
]

export function monthlyAmortization(tcp = 0, downpayment = 0, terms = '') {
  const balance = round2(Number(tcp) - Number(downpayment))
  const months = Number(terms)
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(months) || months <= 0) return 0
  if (months <= 36) return round2(balance / months)
  const monthlyRate = 0.12 / 12
  const factor = (1 + monthlyRate) ** months
  return round2((balance * monthlyRate * factor) / (factor - 1))
}

export function buildLedger(payments = [], tcp = 0) {
  const sorted = [...payments].sort((a, b) => {
    const da = String(a.entry_date ?? '')
    const db = String(b.entry_date ?? '')
    if (da !== db) return da < db ? -1 : 1
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  })
  let balance = round2(Number(tcp) || 0)
  const rows = sorted.map((payment) => {
    const amount = Number(payment.amount) || 0
    const surcharge = Number(payment.surcharge) || 0
    const interest = Number(payment.interest) || 0
    const principal = round2(amount - surcharge - interest)
    balance = round2(balance - principal)
    return { ...payment, principal, balance }
  })
  return {
    rows,
    totalAmount: round2(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)),
    totalPrincipal: round2(rows.reduce((sum, row) => sum + row.principal, 0)),
    remainingBalance: balance,
  }
}

export function ledgerCsvRows(ledger) {
  return ledger.rows.map((row) => [
    row.entry_date ?? '',
    row.or_number ?? '',
    row.amount,
    row.surcharge,
    row.interest,
    row.principal,
    row.balance,
    row.remarks ?? '',
  ])
}
