import { useCallback, useEffect, useState } from 'react'
import { fetchProjectLots, fetchProjects } from '../../lib/projects.js'
import { formatPrice } from '../../lib/format.js'
import CreateProjectModal from './CreateProjectModal.jsx'
import ProjectDetail from './ProjectDetail.jsx'

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
  const [selected, setSelected] = useState(null)

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

  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        onBack={() => {
          setSelected(null)
          load()
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Projects</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-gold">Create Project</button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading projects…</p>}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load projects.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {state === 'ready' && projects.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No projects yet. Click "Create Project" to add the first one.
        </p>
      )}

      {state === 'ready' && projects.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Type</th>
                <th className="hidden px-4 py-3 md:table-cell">Address</th>
                <th className="hidden px-4 py-3 sm:table-cell">Price/m²</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const count = counts[project.id] ?? { available: 0, sold: 0, total: 0 }
                return (
                  <tr key={project.id} className="border-b border-mist/70 last:border-0">
                    <td className="px-4 py-3 font-semibold text-brand-deep">{project.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                        {TYPE_LABELS[project.type] ?? project.type}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-ink/70 md:table-cell">{project.address}</td>
                    <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{formatPrice(project.price_per_sqm) ?? '—'}</td>
                    <td className="px-4 py-3 text-ink/70">{count.available} available</td>
                    <td className="px-4 py-3 text-ink/70">{count.sold} sold</td>
                    <td className="px-4 py-3 text-ink/70">{count.total}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(project)}
                        aria-label={`Open ${project.name}`}
                        className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
