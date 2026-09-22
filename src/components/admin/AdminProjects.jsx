import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProjectLots, fetchProjects } from '../../lib/projects.js'
import { formatPrice } from '../../lib/format.js'
import CreateProjectModal from './CreateProjectModal.jsx'
import { Badge, Button, DataTable, ErrorState, LoadingState, PageHeader } from '../shared/ui'

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

  const columns = [
    { key: 'name', header: 'Project', className: 'font-semibold text-brand-deep', render: (project) => project.name },
    {
      key: 'type',
      header: 'Type',
      render: (project) => <Badge tone="brand">{TYPE_LABELS[project.type] ?? project.type}</Badge>,
    },
    { key: 'address', header: 'Address', hideBelow: 'md', className: 'text-ink/70', render: (project) => project.address },
    {
      key: 'price',
      header: 'Price/m²',
      hideBelow: 'sm',
      className: 'text-ink/70',
      render: (project) => formatPrice(project.price_per_sqm) ?? '—',
    },
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
        <Link
          to={`/admin/projects/${project.id}`}
          aria-label={`Open ${project.name}`}
          className="inline-flex rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
        >
          Open
        </Link>
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
            <dt className="text-ink/50">Price/m²</dt>
            <dd className="text-ink/70">{formatPrice(project.price_per_sqm) ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Inventory</dt>
            <dd className="text-ink/70">
              {countsFor.available ?? 0} available · {countsFor.sold ?? 0} sold · {countsFor.total ?? 0} total
            </dd>
          </div>
        </dl>
        <Link
          to={`/admin/projects/${project.id}`}
          aria-label={`Open ${project.name}`}
          className="inline-flex rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
        >
          Open
        </Link>
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
    </div>
  )
}
