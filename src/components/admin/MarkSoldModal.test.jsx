import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkSoldModal from './MarkSoldModal.jsx'

vi.mock('../../lib/agents.js', () => ({ fetchAllAgents: vi.fn() }))
vi.mock('../../lib/sales.js', () => ({ savePropertyWithCommission: vi.fn() }))

import { fetchAllAgents } from '../../lib/agents.js'
import { savePropertyWithCommission } from '../../lib/sales.js'

const lot = {
  id: 'l1',
  project_id: 'pr1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  lot_area_sqm: 100,
  price: 100000,
  status: 'available',
  sold_by: null,
}

const project = { id: 'pr1', name: 'Andor Farm' }

describe('MarkSoldModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllAgents.mockResolvedValue([
      { id: 'admin1', name: 'Admin', role: 'admin', is_active: true },
      { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
      { id: 'a2', name: 'Inactive Agent', role: 'sub_agent', is_active: false },
    ])
    savePropertyWithCommission.mockResolvedValue({ id: 'l1', status: 'sold' })
  })

  it('offers only active non-admin agents as sellers', async () => {
    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    expect(await screen.findByRole('option', { name: 'Ana Sub (Sub Agent)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Admin/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Inactive Agent/ })).not.toBeInTheDocument()
  })

  it('records the sale with the full lot payload and the selected seller', async () => {
    const onSold = vi.fn()
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={onSold} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(savePropertyWithCommission).toHaveBeenCalledWith({
      mode: 'edit',
      propertyId: 'l1',
      payload: { ...lot, status: 'sold', sold_by: 'a1' },
    })
    expect(onSold).toHaveBeenCalled()
  })

  it('requires a seller before saving', async () => {
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await screen.findByRole('option', { name: 'Ana Sub (Sub Agent)' })
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(savePropertyWithCommission).not.toHaveBeenCalled()
    expect(screen.getByText('Select the selling agent.')).toBeInTheDocument()
  })

  it('surfaces field errors from the sales API', async () => {
    savePropertyWithCommission.mockRejectedValue({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(await screen.findByText('Select an active selling agent.')).toBeInTheDocument()
  })

  it('surfaces the paid-commission block', async () => {
    savePropertyWithCommission.mockRejectedValue(new Error('Commission already paid — reverse payment first.'))
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(await screen.findByText('Commission already paid — reverse payment first.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<MarkSoldModal lot={lot} project={project} onClose={onClose} onSold={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
