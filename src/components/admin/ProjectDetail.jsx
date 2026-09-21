import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteLot, fetchProject, fetchProjectLots, updateLot } from '../../lib/projects.js'
import { setPropertyPinned } from '../../lib/api.js'
import { fetchAllAgents } from '../../lib/agents.js'
import { formatPrice } from '../../lib/format.js'
import BuyerLedgerModal from './BuyerLedgerModal.jsx'
import CreateProjectModal from './CreateProjectModal.jsx'
import MarkSoldModal from './MarkSoldModal.jsx'
import UploadLotsModal from './UploadLotsModal.jsx'
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  statusTone,
  useToast,
} from '../shared/ui'

const TYPE_LABELS = {
  farm_lot: 'Farm Lot',
  housing: 'Housing',
  commercial: 'Commercial',
  development: 'Development',
}

const isDuplicateKey = (err) =>
  err?.code === '23505' || String(err?.message ?? '').includes('duplicate key')

const statusLabel = (status) => (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Available')

function EditLotModal({ lot, project, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    block_no: lot.block_no ?? '',
    lot_no: lot.lot_no ?? '',
    area: lot.lot_area_sqm ?? '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

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
      showToast('Lot updated.')
      onSaved()
    } catch (err) {
      if (isDuplicateKey(err)) setError('Block/Lot already exists in this project.')
      else setError(err?.message || 'Could not update the lot. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} label="Edit lot" size="md" busy={saving}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Edit Lot</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-md px-2 py-1 text-ink/50 transition-colors hover:text-ink disabled:opacity-60"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-3">
        <Input id="el-block" autoFocus label="Block" value={form.block_no} onChange={setField('block_no')} />
        <Input id="el-lot" label="Lot" value={form.lot_no} onChange={setField('lot_no')} />
        <Input id="el-area" type="number" min="0" step="any" label="Area (sqm)" value={form.area} onChange={setField('area')} />

        <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [currentProject, setCurrentProject] = useState(null)
  const [projectState, setProjectState] = useState('loading')
  const [lots, setLots] = useState([])
  const [agentNames, setAgentNames] = useState({})
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [pendingPins, setPendingPins] = useState({})
  const [showUpload, setShowUpload] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [markSoldLot, setMarkSoldLot] = useState(null)
  const [ledgerLot, setLedgerLot] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const loadProject = useCallback(() => {
    setProjectState('loading')
    fetchProject(id)
      .then((row) => {
        setCurrentProject(row)
        setProjectState('ready')
      })
      .catch(() => setProjectState('error'))
  }, [id])

  useEffect(loadProject, [loadProject])

  const load = useCallback(() => {
    setState('loading')
    fetchProjectLots(id)
      .then((rows) => {
        setLots(rows)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [id])

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
      showToast('Lot deleted.')
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete the lot. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleProjectSaved = async () => {
    setShowEditProject(false)
    try {
      const fresh = await fetchProject(id)
      setCurrentProject(fresh)
    } catch {
      // keep the current project details when the refresh fails
    }
    load()
  }

  const sortedLots = useMemo(
    () =>
      [...lots].sort((a, b) => {
        const block = String(a.block_no ?? '').localeCompare(String(b.block_no ?? ''), undefined, { numeric: true })
        if (block !== 0) return block
        return String(a.lot_no ?? '').localeCompare(String(b.lot_no ?? ''), undefined, { numeric: true })
      }),
    [lots],
  )

  const counts = {
    total: lots.length,
    available: lots.filter((lot) => lot.status === 'available').length,
    sold: lots.filter((lot) => lot.status === 'sold').length,
  }

  const lotActions = (lot) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        variant={lot.is_pinned ? 'gold' : 'secondary'}
        onClick={() => togglePin(lot)}
        disabled={Boolean(pendingPins[lot.id])}
        aria-pressed={lot.is_pinned}
      >
        {lot.is_pinned ? 'Pinned' : 'Pin'}
      </Button>
      {lot.status === 'available' && (
        <Button size="sm" variant="secondary" onClick={() => setMarkSoldLot(lot)}>
          Mark Sold
        </Button>
      )}
      {lot.status === 'sold' && (
        <Button size="sm" variant="secondary" onClick={() => setLedgerLot(lot)}>
          Ledger
        </Button>
      )}
      {lot.status === 'available' && (
        <Button size="sm" variant="secondary" onClick={() => setEditTarget(lot)}>
          Edit
        </Button>
      )}
      {lot.status === 'available' && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setDeleteError(null)
            setConfirmDelete(lot)
          }}
        >
          Delete
        </Button>
      )}
    </div>
  )

  const lotColumns = [
    { key: 'block', header: 'Block', className: 'font-semibold text-brand-deep', render: (lot) => lot.block_no ?? '—' },
    { key: 'lot', header: 'Lot', className: 'text-ink/70', render: (lot) => lot.lot_no ?? '—' },
    {
      key: 'area',
      header: 'Area',
      className: 'text-ink/70',
      render: (lot) => (lot.lot_area_sqm != null ? `${Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm` : '—'),
    },
    { key: 'price', header: 'Price', className: 'font-semibold text-ink', render: (lot) => formatPrice(lot.price) ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (lot) => <Badge tone={statusTone(lot.status)}>{statusLabel(lot.status)}</Badge>,
    },
    {
      key: 'buyer',
      header: 'Buyer',
      className: 'text-ink/70',
      render: (lot) => lot.sales?.buyer_name ?? lot.sales?.[0]?.buyer_name ?? '—',
    },
    {
      key: 'soldBy',
      header: 'Sold by',
      hideBelow: 'sm',
      className: 'text-ink/70',
      render: (lot) => (lot.status === 'sold' ? (agentNames[lot.sold_by] ?? '—') : '—'),
    },
    { key: 'actions', header: 'Actions', align: 'right', noWrap: true, render: lotActions },
  ]

  const lotCard = (lot) => (
    <div className="rounded-lg border border-mist bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-semibold text-brand-deep">
          Block {lot.block_no ?? '—'} Lot {lot.lot_no ?? '—'}
        </p>
        <Badge tone={statusTone(lot.status)}>{statusLabel(lot.status)}</Badge>
      </div>
      <dl className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Area</dt>
          <dd className="text-ink/70">
            {lot.lot_area_sqm != null ? `${Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Price</dt>
          <dd className="font-semibold text-ink">{formatPrice(lot.price) ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Buyer</dt>
          <dd className="text-ink/70">{lot.sales?.buyer_name ?? lot.sales?.[0]?.buyer_name ?? '—'}</dd>
        </div>
        {lot.status === 'sold' && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Sold by</dt>
            <dd className="text-ink/70">{agentNames[lot.sold_by] ?? '—'}</dd>
          </div>
        )}
      </dl>
      {lotActions(lot)}
    </div>
  )

  const backButton = (
    <button
      onClick={() => navigate('/admin/projects')}
      className="mb-4 rounded-md text-sm font-semibold text-ink/60 transition-colors hover:text-brand"
    >
      ← Projects
    </button>
  )

  if (projectState === 'loading') {
    return (
      <div>
        {backButton}
        <LoadingState label="Loading project…" />
      </div>
    )
  }

  if (projectState === 'error') {
    return (
      <div>
        {backButton}
        <ErrorState message="Could not load this project." onRetry={loadProject} />
      </div>
    )
  }

  return (
    <div>
      {backButton}

      <PageHeader
        title={currentProject.name}
        description={`${TYPE_LABELS[currentProject.type] ?? currentProject.type} · ${currentProject.address} · ${formatPrice(currentProject.price_per_sqm) ?? '—'} / m²`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowEditProject(true)}>
              Edit Project
            </Button>
            <Button onClick={() => setShowUpload(true)}>Upload Lots</Button>
          </>
        }
      />

      <p className="mb-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
        <span>{counts.total} lots</span>
        <span>{counts.available} available</span>
        <span>{counts.sold} sold</span>
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {state === 'loading' && <LoadingState label="Loading lots…" />}

      {state === 'error' && <ErrorState message="Could not load lots." onRetry={load} />}

      {state === 'ready' && (
        <DataTable
          columns={lotColumns}
          rows={sortedLots}
          getRowKey={(lot) => lot.id}
          emptyMessage='No lots yet. Click "Upload Lots" to import them from Excel.'
          mobileCard={lotCard}
        />
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
          onImported={() => {
            setShowUpload(false)
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
