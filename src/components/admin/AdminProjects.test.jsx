import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminProjects from './AdminProjects.jsx'

vi.mock('../../lib/projects.js', () => ({
  fetchProjects: vi.fn(),
  fetchProjectLots: vi.fn(),
}))

vi.mock('./CreateProjectModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Create project">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import { fetchProjectLots, fetchProjects } from '../../lib/projects.js'

const farm = { id: 'pr1', name: 'Andor Farm', type: 'farm_lot', address: 'Brgy. Andor', price_per_sqm: 1000 }
const housing = { id: 'pr2', name: 'Andor Homes', type: 'housing', address: 'Lipa', price_per_sqm: 5000 }

function renderProjects() {
  return render(
    <MemoryRouter initialEntries={['/admin/projects']}>
      <Routes>
        <Route path="/admin/projects" element={<AdminProjects />} />
        <Route path="/admin/projects/:id" element={<p>ProjectDetailPage</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProjects.mockResolvedValue([farm, housing])
    fetchProjectLots.mockImplementation((id) =>
      id === 'pr1'
        ? Promise.resolve([{ id: 'l1', status: 'available' }, { id: 'l2', status: 'sold' }])
        : Promise.resolve([{ id: 'l3', status: 'available' }]),
    )
  })

  it('lists projects with type badges and per-project lot counts', async () => {
    renderProjects()

    expect(await screen.findByText('Andor Farm')).toBeInTheDocument()
    expect(screen.getByText('Andor Homes')).toBeInTheDocument()
    expect(screen.getByText('Farm Lot')).toBeInTheDocument()
    expect(screen.getByText('Housing')).toBeInTheDocument()
    expect(screen.getAllByText('1 available')).toHaveLength(2)
    expect(screen.getByText('1 sold')).toBeInTheDocument()

    const farmRow = screen.getByText('Andor Farm').closest('tr')
    expect(within(farmRow).getByText('2')).toBeInTheDocument()
    expect(within(farmRow).getByText('₱ 1,000')).toBeInTheDocument()
  })

  it('counts lots per project', async () => {
    renderProjects()

    await screen.findByText('Andor Farm')

    expect(fetchProjectLots).toHaveBeenCalledWith('pr1')
    expect(fetchProjectLots).toHaveBeenCalledWith('pr2')
  })

  it('opens the create project modal', async () => {
    const user = userEvent.setup()

    renderProjects()

    await user.click(await screen.findByRole('button', { name: 'Create Project' }))

    expect(screen.getByRole('dialog', { name: 'Create project' })).toBeInTheDocument()
  })

  it('navigates to the project route when opening a project', async () => {
    const user = userEvent.setup()

    renderProjects()

    const openLinks = await screen.findAllByRole('link', { name: 'Open Andor Farm' })
    await user.click(openLinks[0])

    expect(await screen.findByText('ProjectDetailPage')).toBeInTheDocument()
  })

  it('labels each open action with the project name', async () => {
    renderProjects()

    expect(await screen.findByRole('link', { name: 'Open Andor Farm' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Andor Homes' })).toBeInTheDocument()
  })

  it('shows a retry state when loading fails', async () => {
    fetchProjects.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    renderProjects()

    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Andor Farm')).toBeInTheDocument()
  })

  it('shows an empty state when there are no projects', async () => {
    fetchProjects.mockResolvedValue([])

    renderProjects()

    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument()
  })
})
