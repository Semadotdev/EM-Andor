import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyForm from './PropertyForm.jsx'

vi.mock('../../lib/api.js', () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'

const payload = {
  name: 'Andor Ridge Lot A',
  type: 'residential lot',
  location: 'Batangas City',
  lot_area_sqm: 150,
  price: 1500000,
  description: 'Corner lot',
  image_url: null,
  is_pinned: false,
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

    expect(createProperty).toHaveBeenCalledWith(payload)
    expect(onSaved).toHaveBeenCalledWith(created)
  })

  it('edits an existing property by id', async () => {
    const existing = { id: 'p7', ...payload, price: 2000000 }
    const updated = { ...existing, name: 'Andor Ridge Lot A (Reserved)' }
    updateProperty.mockResolvedValue(updated)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByLabelText('Name')).toHaveValue(existing.name)
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Andor Ridge Lot A (Reserved)')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(updateProperty).toHaveBeenCalledWith('p7', expect.objectContaining({ name: 'Andor Ridge Lot A (Reserved)', price: 2000000 }))
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

    expect(uploadPropertyImage).toHaveBeenCalledWith(file)
    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({ image_url: 'https://cdn.example.com/lot-a.jpg' }),
    )
  })
})
