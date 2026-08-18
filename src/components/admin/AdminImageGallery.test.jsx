import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { fetchProperties, updateProperty, uploadPropertyImage } from '../../lib/api.js'
import AdminImageGallery from './AdminImageGallery.jsx'

const mockProperties = [
  { id: '1', name: 'Sunset Lot', location: 'Tagaytay', image_url: 'https://example.com/sunset.jpg', created_at: '2026-01-15T00:00:00Z' },
  { id: '2', name: 'Hillside Villa', location: 'BGC', image_url: 'https://example.com/hillside.jpg', created_at: '2026-03-10T00:00:00Z' },
  { id: '3', name: 'Beach Front', location: 'Batangas', image_url: null, created_at: '2026-02-01T00:00:00Z' },
  { id: '4', name: 'City View', location: 'Makati', image_url: 'https://example.com/cityview.jpg', created_at: '2026-04-01T00:00:00Z' },
]

describe('AdminImageGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue({ data: mockProperties })
  })

  it('renders gallery with property images (filters out no-image properties)', async () => {
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Image Gallery')).toBeInTheDocument()
    })
    expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    expect(screen.getByText('Hillside Villa')).toBeInTheDocument()
    expect(screen.getByText('City View')).toBeInTheDocument()
    expect(screen.queryByText('Beach Front')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 3 images')).toBeInTheDocument()
  })

  it('filters by search term', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Search images'), 'Tagaytay')
    await waitFor(() => {
      expect(screen.getByText('Showing 1 image')).toBeInTheDocument()
    })
    expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    expect(screen.queryByText('Hillside Villa')).not.toBeInTheDocument()
  })

  it('sorts by name descending', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Sort images'), 'name_desc')
    const names = screen.getAllByText(/Lot|Villa|View/).map((el) => el.textContent)
    expect(names[0]).toContain('Sunset')
    expect(names[names.length - 1]).toContain('City')
  })

  it('shows empty state when no images match search', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Search images'), 'zzzznonexistent')
    await waitFor(() => {
      expect(screen.getByText('No images match your search.')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    fetchProperties.mockReturnValue(new Promise(() => {}))
    render(<AdminImageGallery />)
    expect(screen.getByText('Loading images…')).toBeInTheDocument()
  })

  it('opens lightbox when clicking preview button', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    })

    const previewButtons = screen.getAllByLabelText(/Preview/)
    await user.click(previewButtons[0])
    expect(screen.getByRole('dialog', { name: /image preview/i })).toBeInTheDocument()
  })

  it('closes lightbox on escape key', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    })

    const previewButtons = screen.getAllByLabelText(/Preview/)
    await user.click(previewButtons[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('calls updateProperty on delete confirmation', async () => {
    updateProperty.mockResolvedValue({})
    fetchProperties.mockResolvedValueOnce({ data: mockProperties })
    fetchProperties.mockResolvedValueOnce({ data: mockProperties.filter((p) => p.id !== '4') })

    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Sunset Lot')).toBeInTheDocument()
    })

    const removeButtons = screen.getAllByLabelText(/Remove/)
    await user.click(removeButtons[0])

    await screen.findByText('Remove Image')
    await user.click(screen.getByText('Remove'))

    await waitFor(() => {
      expect(updateProperty).toHaveBeenCalledWith('4', { image_url: null })
    })
  })

  it('opens upload modal and closes on cancel', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Image Gallery')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Upload Image'))
    expect(screen.getByText('Upload Property Image')).toBeInTheDocument()
    expect(screen.getByLabelText('Property')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText('Upload Property Image')).not.toBeInTheDocument()
    })
  })

  it('enables upload button only when property and file are selected', async () => {
    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Image Gallery')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Upload Image'))
    const uploadBtn = screen.getByRole('button', { name: 'Upload' })
    expect(uploadBtn).toBeDisabled()
  })

  it('calls uploadPropertyImage and updateProperty on upload', async () => {
    uploadPropertyImage.mockResolvedValue('https://example.com/new.jpg')
    updateProperty.mockResolvedValue({})
    fetchProperties.mockResolvedValue({ data: mockProperties })

    const user = userEvent.setup()
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Image Gallery')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Upload Image'))

    await user.selectOptions(screen.getByLabelText('Property'), '1')

    const fileInput = screen.getByLabelText('Image File')
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    const uploadBtn = screen.getByRole('button', { name: 'Upload' })
    expect(uploadBtn).not.toBeDisabled()

    await user.click(uploadBtn)

    await waitFor(() => {
      expect(uploadPropertyImage).toHaveBeenCalledWith(file)
      expect(updateProperty).toHaveBeenCalledWith('1', { image_url: 'https://example.com/new.jpg' })
    })
  })

  it('shows error state on load failure', async () => {
    fetchProperties.mockRejectedValue(new Error('fail'))
    render(<AdminImageGallery />)
    await waitFor(() => {
      expect(screen.getByText('Could not load images.')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })
})
