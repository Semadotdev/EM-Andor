import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import { deleteLot, fetchProject, fetchProjectLots, updateLot } from '../../lib/projects.js'
import { setPropertyPinned } from '../../lib/api.js'
import { fetchAllAgents } from '../../lib/agents.js'
import { formatPrice } from '../../lib/format.js'
import BuyerLedgerModal from './BuyerLedgerModal.jsx'
import CreateProjectModal from './CreateProjectModal.jsx'
import MarkSoldModal from './MarkSoldModal.jsx'
import UploadLotsModal from './UploadLotsModal.jsx'

const TYPE_LABELS = {
  farm_lot: 'Farm Lot',
  housing: 'Housing',
  commercial: 'Commercial',
  development: 'Development',
}

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const isDuplicateKey = (err) =>
  err?.code === '23505' || String(err?.message ?? '').includes('duplicate key')

function statusBadgeCls(status) {
  if (status === 'sold') return 'bg-red-100 text-red-700'
  if (status === 'reserved') return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function EditLotModal({ lot, project, onClose, onSaved }) {
  const [form, setForm] = useState({
    block_no: lot.block_no ?? '',
    lot_no: lot.lot_no ?? '',
    area: lot.lot_area_sqm ?? '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.block_no.trim() || !form.lot_no.trim()) {
      setError('Block and Lot are required.')
      return
    }
    const area = Number(form.area)
    if (form.area === '' || Number.isNaN(area) || area <= 0) {
      setError('Area must be a number greater than 0.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateLot(lot, project, { block_no: form.block_no.trim(), lot_no: form.lot_no.trim(), area })
      onSaved()
    } catch (err) {
      if (isDuplicateKey(err)) setError('Block/Lot already exists in this project.')
      else setError(err?.message || 'Could not update the lot. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit lot"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">Edit Lot</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="el-block" className="mb-1.5 block text-sm font-semibold text-brand-deep">Block</label>
            <input id="el-block" autoFocus className={inputCls} value={form.block_no} onChange={setField('block_no')} />
          </div>
          <div>
            <label htmlFor="el-lot" className="mb-1.5 block text-sm font-semibold text-brand-deep">Lot</label>
            <input id="el-lot" className={inputCls} value={form.lot_no} onChange={setField('lot_no')} />
          </div>
          <div>
            <label htmlFor="el-area" className="mb-1.5 block text-sm font-semibold text-brand-deep">Area (sqm)</label>
            <input id="el-area" type="number" min="0" step="any" className={inputCls} value={form.area} onChange={setField('area')} />
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-3">
            <button type="button" onClick={onClose} disabled={saving} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-gold disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectDetail({ project, onBack }) {
  const [currentProject, setCurrentProject] = useState(project)
  const [lots, setLots] = useState([])
  const [agentNames, setAgentNames] = useState({})
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [pendingPins, setPendingPins] = useState({})
  const [showUpload, setShowUpload] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [markSoldLot, setMarkSoldLot] = useState(null)
  const [ledgerLot, setLedgerLot] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    setCurrentProject(project)
  }, [project])

  const load = useCallback(() => {
    setState('loading')
    fetchProjectLots(project.id)
      .then((rows) => {
        setLots(rows)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [project.id])

  useEffect(load, [load])

  useEffect(() => {
    let mounted = true
    fetchAllAgents()
      .then((rows) => {
        if (mounted) setAgentNames(Object.fromEntries(rows.map((a) => [a.id, a.name])))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const togglePin = async (lot) => {
    if (pendingPins[lot.id]) return
    const next = !lot.is_pinned
    const prev = lot.is_pinned
    setError(null)
    setPendingPins((pins) => ({ ...pins, [lot.id]: true }))
    setLots((list) => list.map((x) => (x.id === lot.id ? { ...x, is_pinned: next } : x)))
    try {
      await setPropertyPinned(lot.id, next)
    } catch {
      setLots((list) => list.map((x) => (x.id === lot.id ? { ...x, is_pinned: prev } : x)))
      setError('Could not update pin status. Please try again.')
    } finally {
      setPendingPins((pins) => ({ ...pins, [lot.id]: false }))
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteLot(confirmDelete.id)
      setLots((list) => list.filter((x) => x.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete the lot. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleProjectSaved = async () => {
    setShowEditProject(false)
    try {
      const fresh = await fetchProject(project.id)
      setCurrentProject(fresh)
    } catch {
      // keep the current project details when the refresh fails
    }
    load()
  }

  const counts = {
    total: lots.length,
    available: lots.filter((lot) => lot.status === 'available').length,
    sold: lots.filter((lot) => lot.status === 'sold').length,
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 rounded-md text-sm font-semibold text-ink/60 transition-colors hover:text-brand"
      >
        ← Back to Projects
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-brand-deep">{currentProject.name}</h1>
          <p className="mt-1 text-sm text-ink/70">
            {TYPE_LABELS[currentProject.type] ?? currentProject.type} · {currentProject.address} · {formatPrice(currentProject.price_per_sqm) ?? '—'} / m²
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
            <span>{counts.total} lots</span>
            <span>{counts.available} available</span>
            <span>{counts.sold} sold</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowEditProject(true)}
            className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand"
          >
            Edit Project
          </button>
          <button onClick={() => setShowUpload(true)} className="btn btn-gold">Upload Lots</button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
          {notice}
        </p>
      )}

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading lots…</p>}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load lots.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {state === 'ready' && lots.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No lots yet. Click "Upload Lots" to import them from Excel.
        </p>
      )}

      {state === 'ready' && lots.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Lot</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="hidden px-4 py-3 sm:table-cell">Sold by</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3 font-semibold text-brand-deep">{lot.block_no ?? '—'}</td>
                  <td className="px-4 py-3 text-ink/70">{lot.lot_no ?? '—'}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {lot.lot_area_sqm != null ? `${Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm` : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatPrice(lot.price) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeCls(lot.status)}`}>
                      {lot.status ? lot.status.charAt(0).toUpperCase() + lot.status.slice(1) : 'Available'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {lot.sales?.buyer_name ?? lot.sales?.[0]?.buyer_name ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">
                    {lot.status === 'sold' ? (agentNames[lot.sold_by] ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => togglePin(lot)}
                        disabled={Boolean(pendingPins[lot.id])}
                        aria-pressed={lot.is_pinned}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          lot.is_pinned
                            ? 'border-gold bg-gold text-brand-deep'
                            : 'border-mist text-ink/70 hover:border-brand/40 hover:text-brand'
                        }`}
                      >
                        {lot.is_pinned ? 'Pinned' : 'Pin'}
                      </button>
                      {lot.status === 'available' && (
                        <button
                          onClick={() => setMarkSoldLot(lot)}
                          className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                        >
                          Mark Sold
                        </button>
                      )}
                      {lot.status === 'sold' && (
                        <button
                          onClick={() => setLedgerLot(lot)}
                          className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                        >
                          Ledger
                        </button>
                      )}
                      {lot.status === 'available' && (
                        <button
                          onClick={() => setEditTarget(lot)}
                          className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                        >
                          Edit
                        </button>
                      )}
                      {lot.status === 'available' && (
                        <button
                          onClick={() => {
                            setDeleteError(null)
                            setConfirmDelete(lot)
                          }}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEditProject && (
        <CreateProjectModal
          project={currentProject}
          onClose={() => setShowEditProject(false)}
          onCreated={handleProjectSaved}
        />
      )}

      {markSoldLot && (
        <MarkSoldModal
          lot={markSoldLot}
          project={currentProject}
          onClose={() => setMarkSoldLot(null)}
          onSold={() => {
            setMarkSoldLot(null)
            load()
          }}
        />
      )}

      {ledgerLot && (
        <BuyerLedgerModal
          lot={ledgerLot}
          project={currentProject}
          onClose={() => setLedgerLot(null)}
          onChanged={() => load()}
        />
      )}

      {showUpload && (
        <UploadLotsModal
          project={currentProject}
          onClose={() => setShowUpload(false)}
          onImported={(count) => {
            setShowUpload(false)
            setNotice(`Imported ${count} lot${count === 1 ? '' : 's'}.`)
            load()
          }}
        />
      )}

      {editTarget && (
        <EditLotModal
          lot={editTarget}
          project={currentProject}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            load()
          }}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Lot"
        message={confirmDelete ? `Delete Block ${confirmDelete.block_no ?? '—'} Lot ${confirmDelete.lot_no ?? '—'}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        destructive
        loading={deleting}
      >
        {deleteError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {deleteError}
          </p>
        )}
      </ConfirmModal>
    </div>
  )
}
