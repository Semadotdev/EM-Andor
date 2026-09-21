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
  const [addForm, setAddForm] = useState(emptyPaymentForm)
  const [addErrors, setAddErrors] = useState({})
  const [addError, setAddError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showEditSale, setShowEditSale] = useState(false)

  const ledger = useMemo(() => buildLedger(payments, sale?.tcp), [payments, sale?.tcp])

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

  const setAddField = (field) => (e) => {
    setAddForm((f) => ({ ...f, [field]: e.target.value }))
    setAddErrors((errs) => ({ ...errs, [field]: undefined }))
    setAddError(null)
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    if (adding) return

    const errors = {}
    if (!addForm.entry_date) errors.entry_date = 'DATE is required.'
    const amount = Number(addForm.amount)
    if (addForm.amount === '' || Number.isNaN(amount) || amount <= 0) errors.amount = 'AMOUNT must be greater than 0.'
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors)
      return
    }

    setAdding(true)
    setAddErrors({})
    setAddError(null)
    try {
      await createPayment(lot.id, {
        entry_date: addForm.entry_date,
        or_number: addForm.or_number.trim(),
        amount,
        surcharge: Number(addForm.surcharge) || 0,
        interest: Number(addForm.interest) || 0,
        remarks: addForm.remarks.trim(),
      })
      setAddForm(emptyPaymentForm)
      await reloadPayments()
      showToast('Payment added.')
      onChanged?.()
    } catch {
      setAddError('Could not add the payment. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (payment) => {
    setEditErrors({})
    setEditForm({
      id: payment.id,
      entry_date: payment.entry_date ?? '',
      or_number: payment.or_number ?? '',
      amount: payment.amount != null ? String(payment.amount) : '',
      surcharge: payment.surcharge != null ? String(payment.surcharge) : '',
      interest: payment.interest != null ? String(payment.interest) : '',
      remarks: payment.remarks ?? '',
    })
  }

  const setEditField = (field) => (e) => {
    setEditForm((f) => ({ ...f, [field]: e.target.value }))
    setEditErrors((errs) => ({ ...errs, [field]: undefined }))
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editForm) return

    const errors = {}
    if (!editForm.entry_date) errors.entry_date = 'DATE is required.'
    const amount = Number(editForm.amount)
    if (editForm.amount === '' || Number.isNaN(amount) || amount <= 0) errors.amount = 'AMOUNT must be greater than 0.'
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }

    try {
      await updatePayment(editForm.id, {
        entry_date: editForm.entry_date,
        or_number: editForm.or_number.trim(),
        amount,
        surcharge: Number(editForm.surcharge) || 0,
        interest: Number(editForm.interest) || 0,
        remarks: editForm.remarks.trim(),
      })
      setEditForm(null)
      await reloadPayments()
      showToast('Payment updated.')
      onChanged?.()
    } catch {
      setEditErrors({ form: 'Could not save the payment. Please try again.' })
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
            <dl className="mb-5 grid gap-x-6 gap-y-3 rounded-lg border border-mist bg-surface p-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-brand-deep">Buyer</dt>
                <dd className="text-right text-ink/70">{sale?.buyer_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-brand-deep">Project</dt>
                <dd className="text-right text-ink/70">{project?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-brand-deep">Blk/Lot</dt>
                <dd className="text-right text-ink/70">{lotLabel}</dd>
              </div>
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
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-brand-deep">Buyer Address</dt>
                <dd className="text-right text-ink/70">{sale?.buyer_address ?? '—'}</dd>
              </div>
            </dl>

            <div className="mb-4 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowEditSale(true)}>
                Edit Sale
              </Button>
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-mist">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">OR#</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Surcharge</th>
                    <th className="px-3 py-3">Interest</th>
                    <th className="px-3 py-3">Principal</th>
                    <th className="px-3 py-3">Balance of Principal</th>
                    <th className="px-3 py-3">Remarks</th>
                    <th className="px-3 py-3 text-right">Actions</th>
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
                      {editForm?.id === row.id ? (
                        <>
                          <td className="px-3 py-2">
                            <Input
                              type="date"
                              aria-label="DATE"
                              value={editForm.entry_date}
                              onChange={setEditField('entry_date')}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input aria-label="OR#" value={editForm.or_number} onChange={setEditField('or_number')} />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="any" aria-label="AMOUNT" value={editForm.amount} onChange={setEditField('amount')} />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="any" aria-label="SURCHARGE" value={editForm.surcharge} onChange={setEditField('surcharge')} />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="any" aria-label="INTEREST" value={editForm.interest} onChange={setEditField('interest')} />
                          </td>
                          <td className="px-3 py-2 font-semibold text-ink"><Money value={row.principal} /></td>
                          <td className="px-3 py-2 font-semibold text-ink"><Money value={row.balance} /></td>
                          <td className="px-3 py-2">
                            <Input aria-label="REMARKS" value={editForm.remarks} onChange={setEditField('remarks')} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" onClick={submitEdit}>
                                Save
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditForm(null)}>
                                Cancel
                              </Button>
                            </div>
                            {Object.entries(editErrors)
                              .filter(([, message]) => message)
                              .map(([field, message]) => (
                                <p key={field} className="mt-1.5 text-right text-xs font-medium text-red-600" role="alert">
                                  {message}
                                </p>
                              ))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-ink/70">{row.entry_date ?? '—'}</td>
                          <td className="px-3 py-3 text-ink/70">{row.or_number ?? '—'}</td>
                          <td className="px-3 py-3 text-ink"><Money value={row.amount} /></td>
                          <td className="px-3 py-3 text-ink/70"><Money value={row.surcharge} /></td>
                          <td className="px-3 py-3 text-ink/70"><Money value={row.interest} /></td>
                          <td className="px-3 py-3 font-semibold text-ink"><Money value={row.principal} /></td>
                          <td className="px-3 py-3 font-semibold text-ink"><Money value={row.balance} /></td>
                          <td className="px-3 py-3 text-ink/70">{row.remarks || '—'}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => startEdit(row)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(row)}>
                                Delete
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
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

            <form onSubmit={submitPayment} noValidate className="mt-6 rounded-lg border border-mist bg-surface p-4">
              <h3 className="mb-3 text-sm font-bold text-brand-deep">Add payment</h3>

              {addError && (
                <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {addError}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Input id="bl-date" type="date" label="DATE" value={addForm.entry_date} onChange={setAddField('entry_date')} error={addErrors.entry_date} />
                <Input id="bl-or" label="OR#" value={addForm.or_number} onChange={setAddField('or_number')} />
                <Input
                  id="bl-amount"
                  type="number"
                  min="0"
                  step="any"
                  label="AMOUNT"
                  value={addForm.amount}
                  onChange={setAddField('amount')}
                  error={addErrors.amount}
                />
                <Input id="bl-surcharge" type="number" min="0" step="any" label="SURCHARGE" value={addForm.surcharge} onChange={setAddField('surcharge')} />
                <Input id="bl-interest" type="number" min="0" step="any" label="INTEREST" value={addForm.interest} onChange={setAddField('interest')} />
                <Input id="bl-remarks" label="REMARKS" value={addForm.remarks} onChange={setAddField('remarks')} />
              </div>

              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={adding}>
                  {adding ? 'Adding…' : 'Add Payment'}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

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
