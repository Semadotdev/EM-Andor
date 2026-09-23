import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteProject, fetchProjectLots, fetchProjects } from '../../lib/projects.js'
import CreateProjectModal from './CreateProjectModal.jsx'
import { Badge, Button, ConfirmModal, DataTable, ErrorState, Input, LoadingState, PageHeader, useToast } from '../shared/ui'
import Icon from '../shared/Icon.jsx'

const TYPE_LABELS = {
  farm_lot: 'Farm Lot',
  housing: 'Housing',
  commercial: 'Commercial',
  development: 'Development',
}

export default function AdminProjects() {
  const [projects, setProjects] = useState([])
  const [counts, setCounts] = useState({})
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const { showToast } = useToast()

  const load = useCallback(() => {
    setState('loading')
    setError(null)
    fetchProjects()
      .then(async (rows) => {
        const lists = await Promise.all(rows.map((project) => fetchProjectLots(project.id)))
        setCounts(Object.fromEntries(rows.map((project, i) => {
          const lots = lists[i] ?? []
          return [project.id, {
            total: lots.length,
            available: lots.filter((lot) => lot.status === 'available').length,
            sold: lots.filter((lot) => lot.status === 'sold').length,
          }]
        })))
        setProjects(rows)
        setState('ready')
      })
      .catch((err) => {
        setError(err?.message || 'Could not load projects.')
        setState('error')
      })
  }, [])

  useEffect(load, [load])

  const openDelete = (project) => {
    setDeleteTarget(project)
    setDeletePassword('')
    setDeleteError(null)
  }

  const closeDelete = () => {
    setDeleteTarget(null)
    setDeletePassword('')
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.')
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProject(deleteTarget.id, deletePassword)
      closeDelete()
      showToast(`${deleteTarget.name} deleted.`)
      load()
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete the project.')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Project', className: 'font-semibold text-brand-deep', render: (project) => project.name },
    {
      key: 'type',
      header: 'Type',
      render: (project) => <Badge tone="brand">{TYPE_LABELS[project.type] ?? project.type}</Badge>,
    },
    { key: 'address', header: 'Address', hideBelow: 'md', className: 'text-ink/70', render: (project) => project.address },
    {
      key: 'available',
      header: 'Available',
      className: 'text-ink/70',
      render: (project) => `${(counts[project.id] ?? {}).available ?? 0} available`,
    },
    {
      key: 'sold',
      header: 'Sold',
      className: 'text-ink/70',
      render: (project) => `${(counts[project.id] ?? {}).sold ?? 0} sold`,
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-ink/70',
      render: (project) => (counts[project.id] ?? {}).total ?? 0,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      noWrap: true,
      render: (project) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/admin/projects/${project.id}`}
            aria-label={`Open ${project.name}`}
            className="inline-flex rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={() => openDelete(project)}
            aria-label={`Delete ${project.name}`}
            className="rounded-md border border-mist p-1.5 text-ink/50 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="trash" className="size-4" />
          </button>
        </div>
      ),
    },
  ]

  const projectCard = (project) => {
    const countsFor = counts[project.id] ?? {}
    return (
      <div className="rounded-lg border border-mist bg-white p-4 text-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-semibold text-brand-deep">{project.name}</p>
          <Badge tone="brand">{TYPE_LABELS[project.type] ?? project.type}</Badge>
        </div>
        {project.address && <p className="mb-3 text-xs text-ink/50">{project.address}</p>}
        <dl className="mb-3 space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Inventory</dt>
            <dd className="text-ink/70">
              {countsFor.available ?? 0} available · {countsFor.sold ?? 0} sold · {countsFor.total ?? 0} total
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex justify-end">
          <Link
            to={`/admin/projects/${project.id}`}
            aria-label={`Open ${project.name}`}
            className="inline-flex rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={() => openDelete(project)}
            aria-label={`Delete ${project.name}`}
            className="ml-2 inline-flex rounded-md border border-mist p-1.5 text-xs text-ink/50 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="trash" className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every project and its lot inventory."
        actions={<Button onClick={() => setShowCreate(true)}>Create Project</Button>}
      />

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {state === 'loading' && <LoadingState label="Loading projects…" />}

      {state === 'error' && <ErrorState message="Could not load projects." onRetry={load} />}

      {state === 'ready' && (
        <DataTable
          columns={columns}
          rows={projects}
          getRowKey={(project) => project.id}
          emptyMessage='No projects yet. Click "Create Project" to add the first one.'
          mobileCard={projectCard}
        />
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          open
          onClose={closeDelete}
          onConfirm={confirmDelete}
          title="Delete project"
          message={`Deleting ${deleteTarget.name} permanently removes all its lots and every transaction inside it — sales, payments, and commissions. This cannot be undone.`}
          confirmLabel="Delete Project"
          destructive
          loading={deleting}
        >
          <div>
            <Input
              id="project-delete-password"
              label="Admin password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value)
                setDeleteError(null)
              }}
              placeholder="Enter your admin password"
              required
            />
            {deleteError && (
              <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm font-medium text-red-700">
                {deleteError}
              </p>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
