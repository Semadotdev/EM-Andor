import { useEffect, useMemo, useState } from 'react'
import { buildLedger, ledgerCsvRows } from '../../lib/ledger.js'
import { exportToCSV } from '../../lib/csv.js'
import { createPayment, deletePayment, fetchPayments, fetchSale, updatePayment } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { Button, ConfirmModal, ErrorState, Input, LoadingState, Modal, useToast } from '../shared/ui'
import SaleDetailsModal from './SaleDetailsModal.jsx'

const CSV_HEADERS = ['DATE', 'OR#', 'AMOUNT', 'SURCHARGE', 'INTEREST', 'PRINCIPAL', 'BALANCE OF PRINCIPAL', 'REMARKS']

const emptyPaymentForm = {
  entry_date: '',
  or_number: '',
  amount: '',
  surcharge: '',
  interest: '',
  remarks: '',
}

const paymentFormFrom = (payment) => ({
  entry_date: payment.entry_date ?? '',
  or_number: payment.or_number ?? '',
  amount: payment.amount != null ? String(payment.amount) : '',
  surcharge: payment.surcharge != null ? String(payment.surcharge) : '',
  interest: payment.interest != null ? String(payment.interest) : '',
  remarks: payment.remarks ?? '',
})

const slug = (value) =>
  String(value ?? '')
    .trim()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')

function Money({ value }) {
  return <span>{formatPrice(value) ?? '—'}</span>
}

export default function BuyerLedgerModal({ lot, project, onClose, onChanged }) {
  const { showToast } = useToast()
  const [sale, setSale] = useState(null)
  const [payments, setPayments] = useState([])
  const [state, setState] = useState('loading')
  const [showDetails, setShowDetails] = useState(false)
  const [paymentModal, setPaymentModal] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [paymentErrors, setPaymentErrors] = useState({})
  const [paymentError, setPaymentError] = useState(null)
  const [savingPayment, setSavingPayment] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showEditSale, setShowEditSale] = useState(false)

  const ledger = useMemo(() => buildLedger(payments, sale?.tcp), [payments, sale?.tcp])
  const isEditingPayment = paymentModal?.mode === 'edit'

  const load = () => {
    setState('loading')
    Promise.all([fetchSale(lot.id), fetchPayments(lot.id)])
      .then(([saleRow, paymentRows]) => {
        setSale(saleRow)
        setPayments(paymentRows)
        setState('ready')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [lot.id])

  const reloadPayments = () => fetchPayments(lot.id).then(setPayments)

  const setPaymentField = (field) => (e) => {
    setPaymentForm((f) => ({ ...f, [field]: e.target.value }))
    setPaymentErrors((errs) => ({ ...errs, [field]: undefined }))
    setPaymentError(null)
  }

  const openAddPayment = () => {
    setPaymentForm(emptyPaymentForm)
    setPaymentErrors({})
    setPaymentError(null)
    setPaymentModal({ mode: 'add' })
  }

  const openEditPayment = (payment) => {
    setPaymentForm(paymentFormFrom(payment))
    setPaymentErrors({})
    setPaymentError(null)
    setPaymentModal({ mode: 'edit', payment })
  }

  const closePaymentModal = () => {
    if (savingPayment) return
    setPaymentModal(null)
    setPaymentForm(emptyPaymentForm)
    setPaymentErrors({})
    setPaymentError(null)
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    if (savingPayment || !paymentModal) return

    const errors = {}
    if (!paymentForm.entry_date) errors.entry_date = 'DATE is required.'
    const amount = Number(paymentForm.amount)
    if (paymentForm.amount === '' || Number.isNaN(amount) || amount <= 0) errors.amount = 'AMOUNT must be greater than 0.'
    if (Object.keys(errors).length > 0) {
      setPaymentErrors(errors)
      return
    }

    const editing = paymentModal.mode === 'edit'
    const payload = {
      entry_date: paymentForm.entry_date,
      or_number: paymentForm.or_number.trim(),
      amount,
      surcharge: Number(paymentForm.surcharge) || 0,
      interest: Number(paymentForm.interest) || 0,
      remarks: paymentForm.remarks.trim(),
    }

    setSavingPayment(true)
    setPaymentErrors({})
    setPaymentError(null)
    try {
      if (editing) {
        await updatePayment(paymentModal.payment.id, payload)
      } else {
        await createPayment(lot.id, payload)
      }
      setPaymentModal(null)
      setPaymentForm(emptyPaymentForm)
      await reloadPayments()
      showToast(editing ? 'Payment updated.' : 'Payment added.')
      onChanged?.()
    } catch {
      setPaymentError(
        editing ? 'Could not save the payment. Please try again.' : 'Could not add the payment. Please try again.',
      )
    } finally {
      setSavingPayment(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return
    setDeleting(true)
    try {
      await deletePayment(confirmDelete.id)
      setConfirmDelete(null)
      await reloadPayments()
      showToast('Payment deleted.')
      onChanged?.()
    } catch {
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const exportCsv = () => {
    const buyer = slug(sale?.buyer_name) || 'buyer'
    const lotName = slug(lot.name ?? `Block ${lot.block_no} Lot ${lot.lot_no}`) || 'lot'
    exportToCSV(CSV_HEADERS, ledgerCsvRows(ledger), `ledger-${buyer}-${lotName}.csv`)
  }

  const handleSaleSaved = async () => {
    setShowEditSale(false)
    try {
      const fresh = await fetchSale(lot.id)
      setSale(fresh)
    } catch {
      // keep the current buyer details when the refresh fails
    }
    onChanged?.()
  }

  const lotLabel = `Block ${lot.block_no ?? '—'} Lot ${lot.lot_no ?? '—'}`

  return (
    <Modal open onClose={onClose} label="Buyer ledger" size="2xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Buyer's Ledger</h2>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
          ✕
        </button>
      </div>

      <div>
        {state === 'loading' && <LoadingState label="Loading ledger…" />}

        {state === 'error' && <ErrorState message="Could not load the ledger." onRetry={load} />}

        {state === 'ready' && (
          <>
            <div className="mb-5 rounded-lg border border-mist bg-surface p-4 text-sm">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-brand-deep">Buyer</dt>
                  <dd className="text-right text-ink/70">{sale?.buyer_name ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-brand-deep">Blk/Lot</dt>
                  <dd className="text-right text-ink/70">{lotLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-brand-deep">Project</dt>
                  <dd className="text-right text-ink/70">{project?.name ?? '—'}</dd>
                </div>
              </dl>

              <div
                id="ledger-details"
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${showDetails ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  {showDetails && (
                    <dl className="grid gap-x-6 gap-y-3 pt-3 sm:grid-cols-2">
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-brand-deep">Area</dt>
                        <dd className="text-right text-ink/70">
                          {lot.lot_area_sqm != null ? `${Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm` : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-brand-deep">Price/m²</dt>
                        <dd className="text-right text-ink/70">
                          {project?.price_per_sqm != null ? `${formatPrice(project.price_per_sqm)} / m²` : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-brand-deep">TCP</dt>
                        <dd className="text-right text-ink/70">{formatPrice(sale?.tcp) ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-brand-deep">Downpayment</dt>
                        <dd className="text-right text-ink/70">{formatPrice(sale?.downpayment) ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-brand-deep">M.A.</dt>
                        <dd className="text-right text-ink/70">{formatPrice(sale?.monthly_amortization) ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-brand-deep">Terms</dt>
                        <dd className="text-right text-ink/70">{sale?.terms_of_payment ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4 sm:col-span-2">
                        <dt className="font-semibold text-brand-deep">Buyer Address</dt>
                        <dd className="text-right text-ink/70">{sale?.buyer_address ?? '—'}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails((shown) => !shown)}
                aria-expanded={showDetails}
                aria-controls="ledger-details"
                className="-mx-4 -mb-4 mt-3 flex w-[calc(100%+2rem)] items-center justify-center gap-2 rounded-b-lg border-t border-mist bg-white/60 px-4 py-2.5 text-xs font-semibold text-ink/70 transition-colors hover:text-brand"
              >
                {showDetails ? 'Show less' : 'Show more details'}
                <span aria-hidden="true">{showDetails ? '▴' : '▾'}</span>
              </button>
            </div>

            <div className="mb-4 flex flex-wrap justify-end gap-3">
              <Button onClick={openAddPayment}>Add Payment</Button>
              <Button variant="secondary" onClick={() => setShowEditSale(true)}>
                Edit Sale
              </Button>
              <Button variant="secondary" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-mist">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">Date</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">OR#</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">Amount</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">Surcharge</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">Interest</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">Principal</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">Balance of Principal</th>
                    <th scope="col" className="px-3 py-3">Remarks</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-ink/60">
                        No payments yet.
                      </td>
                    </tr>
                  )}
                  {ledger.rows.map((row) => (
                    <tr key={row.id} className="border-b border-mist/70 last:border-0">
                      <td className="whitespace-nowrap px-3 py-3 text-ink/70">{row.entry_date ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink/70">{row.or_number ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink"><Money value={row.amount} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink/70"><Money value={row.surcharge} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink/70"><Money value={row.interest} /></td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink"><Money value={row.principal} /></td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink"><Money value={row.balance} /></td>
                      <td className="px-3 py-3 text-ink/70">{row.remarks || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditPayment(row)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(row)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-mist bg-surface text-sm font-semibold text-brand-deep">
                  <tr>
                    <td colSpan={2} className="px-3 py-3 text-right">Total paid</td>
                    <td className="px-3 py-3"><Money value={ledger.totalAmount} /></td>
                    <td colSpan={2} className="px-3 py-3 text-right">Total principal</td>
                    <td className="px-3 py-3"><Money value={ledger.totalPrincipal} /></td>
                    <td colSpan={2} className="px-3 py-3 text-right">
                      Remaining balance: <Money value={ledger.remainingBalance} />
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {paymentModal && (
        <div onClick={(e) => e.stopPropagation()}>
          <Modal
            open
            onClose={closePaymentModal}
            label={isEditingPayment ? 'Edit payment' : 'Add payment'}
            size="lg"
            busy={savingPayment}
          >
            <form onSubmit={submitPayment} noValidate className="grid gap-5 sm:grid-cols-2">
              {paymentError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 sm:col-span-2">
                  {paymentError}
                </p>
              )}

              <Input
                id="bl-date"
                type="date"
                label="DATE"
                value={paymentForm.entry_date}
                onChange={setPaymentField('entry_date')}
                error={paymentErrors.entry_date}
              />
              <Input
                id="bl-or"
                label="OR#"
                value={paymentForm.or_number}
                onChange={setPaymentField('or_number')}
                error={paymentErrors.or_number}
              />
              <Input
                id="bl-amount"
                type="number"
                min="0"
                step="any"
                label="AMOUNT"
                value={paymentForm.amount}
                onChange={setPaymentField('amount')}
                error={paymentErrors.amount}
              />
              <Input
                id="bl-surcharge"
                type="number"
                min="0"
                step="any"
                label="SURCHARGE"
                value={paymentForm.surcharge}
                onChange={setPaymentField('surcharge')}
                error={paymentErrors.surcharge}
              />
              <Input
                id="bl-interest"
                type="number"
                min="0"
                step="any"
                label="INTEREST"
                value={paymentForm.interest}
                onChange={setPaymentField('interest')}
                error={paymentErrors.interest}
              />
              <div className="sm:col-span-2">
                <Input
                  id="bl-remarks"
                  label="REMARKS"
                  value={paymentForm.remarks}
                  onChange={setPaymentField('remarks')}
                  error={paymentErrors.remarks}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
                <Button variant="secondary" onClick={closePaymentModal} disabled={savingPayment}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingPayment}>
                  {savingPayment ? (isEditingPayment ? 'Saving…' : 'Adding…') : isEditingPayment ? 'Save Changes' : 'Add Payment'}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {showEditSale && (
        <div onClick={(e) => e.stopPropagation()}>
          <SaleDetailsModal lot={lot} onClose={() => setShowEditSale(false)} onSaved={handleSaleSaved} />
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmModal
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          title="Delete Payment"
          message={
            confirmDelete
              ? `Delete the ${formatPrice(confirmDelete.amount) ?? '—'} payment dated ${confirmDelete.entry_date ?? '—'}? This cannot be undone.`
              : ''
          }
          confirmLabel="Delete"
          destructive
          loading={deleting}
        />
      </div>
    </Modal>
  )
}
