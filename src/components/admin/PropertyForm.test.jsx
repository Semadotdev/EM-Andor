import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyForm from './PropertyForm.jsx'

vi.mock('../../lib/api.js', () => ({
  createProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn().mockResolvedValue([
    { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
    { id: 'a2', name: 'Ben Direct', role: 'direct_agent', is_active: true },
  ]),
}))

vi.mock('../../lib/sales.js', () => ({
  savePropertyWithCommission: vi.fn(),
}))

import { createProperty, uploadPropertyImage } from '../../lib/api.js'
import { savePropertyWithCommission } from '../../lib/sales.js'

const payload = {
  name: 'Andor Ridge Lot A',
  type: 'residential lot',
  location: 'Batangas City',
  lot_area_sqm: 150,
  price: 1500000,
  description: 'Corner lot',
  status: 'available',
  image_url: null,
  is_pinned: false,
  sold_by: null,
  map_pins: [],
}

async function fillRequiredFields(user) {
  await user.type(screen.getByLabelText('Name'), payload.name)
  await user.selectOptions(screen.getByLabelText('Type'), payload.type)
  await user.type(screen.getByLabelText('Location'), payload.location)
  await user.type(screen.getByLabelText('Lot Area (sqm)'), '150')
  await user.type(screen.getByLabelText('Price (PHP)'), '1500000')
  await user.type(screen.getByLabelText('Description (optional)'), payload.description)
}

describe('PropertyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a property from typed fields', async () => {
    const created = { id: 'p1', ...payload }
    createProperty.mockResolvedValue(created)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={onSaved} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add Property' }))

    expect(createProperty).toHaveBeenCalledWith(payload)
    expect(onSaved).toHaveBeenCalledWith(created)
  })

  it('shows a property summary in the confirmation modal', async () => {
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(within(dialog).getByText('residential lot')).toBeInTheDocument()
    expect(within(dialog).getByText('Batangas City')).toBeInTheDocument()
    expect(within(dialog).getByText('₱1,500,000')).toBeInTheDocument()
  })

  it('defaults status to available and allows changing it', async () => {
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await fillRequiredFields(user)
    expect(screen.getByLabelText('Status')).toHaveValue('available')

    await user.selectOptions(screen.getByLabelText('Status'), 'reserved')
    expect(screen.getByLabelText('Status')).toHaveValue('reserved')

    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('reserved')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Add Property' }))

    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reserved' })
    )
  })

  it('edits an existing property by id', async () => {
    const existing = { id: 'p7', ...payload, price: 2000000 }
    const updated = { ...existing, name: 'Andor Ridge Lot A (Reserved)' }
    savePropertyWithCommission.mockResolvedValue(updated)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByLabelText('Name')).toHaveValue(existing.name)
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Andor Ridge Lot A (Reserved)')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save Changes' }))

    expect(savePropertyWithCommission).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', propertyId: 'p7', payload: expect.objectContaining({ name: 'Andor Ridge Lot A (Reserved)', price: 2000000 }) }),
    )
    expect(onSaved).toHaveBeenCalledWith(updated)
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Select a type.')).toBeInTheDocument()
    expect(screen.getByText('Location is required.')).toBeInTheDocument()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('uploads a selected image and includes its URL in the payload', async () => {
    uploadPropertyImage.mockResolvedValue('https://cdn.example.com/lot-a.jpg')
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    const file = new File(['img'], 'lot-a.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Image'), file)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add Property' }))

    expect(uploadPropertyImage).toHaveBeenCalledWith(file)
    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({ image_url: 'https://cdn.example.com/lot-a.jpg' }),
    )
  })

  it('shows a save error and re-enables the submit button', async () => {
    createProperty.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add Property' }))

    expect(await screen.findByText('Could not save the property. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Property' })).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Saving…' })).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', async () => {
    const onClose = vi.fn()

    render(<PropertyForm mode="create" property={null} onClose={onClose} onSaved={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('adds a lot pin when the map is clicked and includes it in the payload', async () => {
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    const mapImg = screen.getByAltText(/subdivision map/i)
    const mapEl = mapImg.parentElement
    mapEl.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, x: 0, y: 0,
    })
    fireEvent.click(mapEl, { clientX: 250, clientY: 200 })
    fireEvent.click(mapEl, { clientX: 700, clientY: 500 })

    expect(screen.getByRole('button', { name: 'Remove Lot 1 pin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Lot 2 pin' })).toBeInTheDocument()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add Property' }))

    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        map_pins: expect.arrayContaining([
          expect.objectContaining({ name: 'Lot 1', x: 25, y: 25, price: null, lot_area_sqm: null }),
          expect.objectContaining({ name: 'Lot 2', x: 70, y: 62.5 }),
        ]),
      }),
    )
  })

  it('removes a lot pin when its pin or Remove button is clicked', async () => {
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    const mapImg = screen.getByAltText(/subdivision map/i)
    const mapEl = mapImg.parentElement
    mapEl.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, x: 0, y: 0,
    })
    fireEvent.click(mapEl, { clientX: 250, clientY: 200 })
    fireEvent.click(mapEl, { clientX: 700, clientY: 500 })

    await user.click(screen.getByRole('button', { name: 'Remove Lot 1 pin' }))
    expect(screen.queryByRole('button', { name: 'Remove Lot 1 pin' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Lot 2 pin' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('button', { name: 'Remove Lot 2 pin' })).not.toBeInTheDocument()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add Property' }))
    expect(createProperty).toHaveBeenCalledWith(expect.objectContaining({ map_pins: [] }))
  })

  it('edits lot fields and includes them in the payload', async () => {
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    const mapImg = screen.getByAltText(/subdivision map/i)
    const mapEl = mapImg.parentElement
    await user.click(mapEl)
    await user.keyboard('{Enter}')

    await user.clear(screen.getByLabelText('Lot 1 name'))
    await user.type(screen.getByLabelText('Lot 1 name'), 'Lot Corner')
    await user.type(screen.getByLabelText('Lot 1 price'), '900000')
    await user.type(screen.getByLabelText('Lot 1 area'), '120')

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add Property' }))

    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        map_pins: expect.arrayContaining([
          expect.objectContaining({ name: 'Lot Corner', price: 900000, lot_area_sqm: 120, x: 50, y: 50 }),
        ]),
      }),
    )
  })

  it('shows the saved pins when editing and clears them all', async () => {
    const existing = {
      id: 'p7',
      ...payload,
      map_pins: [
        { id: 'l1', name: 'Lot A', price: 1500000, lot_area_sqm: 150, x: 50, y: 75 },
        { id: 'l2', name: 'Lot B', price: 2000000, lot_area_sqm: 200, x: 20, y: 40 },
      ],
    }
    savePropertyWithCommission.mockResolvedValue({ id: 'p7' })
    const user = userEvent.setup()

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByLabelText('Lot 1 name')).toHaveValue('Lot A')
    expect(screen.getByLabelText('Lot 2 name')).toHaveValue('Lot B')
    expect(screen.getByRole('button', { name: 'Remove Lot A pin' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.queryByRole('button', { name: /Remove .* pin/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save Changes' }))
    expect(savePropertyWithCommission).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', propertyId: 'p7', payload: expect.objectContaining({ map_pins: [] }) }),
    )
  })

  it('requires a name for each lot pin', async () => {
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    const mapImg = screen.getByAltText(/subdivision map/i)
    const mapEl = mapImg.parentElement
    await user.click(mapEl)
    await user.keyboard('{Enter}')
    await user.clear(screen.getByLabelText('Lot 1 name'))

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(await screen.findByText('Each lot needs a name.')).toBeInTheDocument()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('requires a price and seller before saving as sold', async () => {
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await fillRequiredFields(user)
    await user.selectOptions(screen.getByLabelText('Status'), 'sold')
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(await screen.findByText('Select the selling agent.')).toBeInTheDocument()
    expect(savePropertyWithCommission).not.toHaveBeenCalled()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('saves a sold property with the selling agent', async () => {
    savePropertyWithCommission.mockResolvedValue({ id: 'p1' })
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={onSaved} />)

    await fillRequiredFields(user)
    await user.selectOptions(screen.getByLabelText('Status'), 'sold')
    await screen.findByRole('option', { name: /Ana Sub/ })
    await user.selectOptions(screen.getByLabelText('Selling Agent'), 'a1')
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Ana Sub')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add Property' }))

    expect(savePropertyWithCommission).toHaveBeenCalledWith({
      mode: 'create',
      propertyId: undefined,
      payload: expect.objectContaining({ status: 'sold', sold_by: 'a1' }),
    })
    expect(onSaved).toHaveBeenCalledWith({ id: 'p1' })
  })

  it('surfaces a paid-commission block from the sales API', async () => {
    savePropertyWithCommission.mockRejectedValue(new Error('Commission already paid — reverse payment first.'))
    const user = userEvent.setup()
    const existing = { id: 'p7', ...payload, status: 'sold', sold_by: 'a1' }

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Commission already paid — reverse payment first.')).toBeInTheDocument()
  })

  it('sends an un-sell through the sale-aware save with a null seller', async () => {
    savePropertyWithCommission.mockResolvedValue({ id: 'p7' })
    const user = userEvent.setup()
    const existing = { id: 'p7', ...payload, status: 'sold', sold_by: 'a1' }

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('Status'), 'available')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(savePropertyWithCommission).toHaveBeenCalledWith({
      mode: 'edit',
      propertyId: 'p7',
      payload: expect.objectContaining({ status: 'available', sold_by: null }),
    })
  })

  it('shows field errors returned by the sales API', async () => {
    savePropertyWithCommission.mockRejectedValue({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    const user = userEvent.setup()
    const existing = { id: 'p7', ...payload, status: 'sold', sold_by: 'a1' }

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Select an active selling agent.')).toBeInTheDocument()
  })
})
