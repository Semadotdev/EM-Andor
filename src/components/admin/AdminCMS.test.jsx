import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCMS from './AdminCMS.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchCMSContentList: vi.fn(),
  fetchCMSContent: vi.fn(),
  updateCMSContent: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { fetchCMSContentList, fetchCMSContent, updateCMSContent, uploadPropertyImage } from '../../lib/api.js'

const samplePages = [
  { page_id: 'home-hero', title: 'Home Hero Section', subtitle: 'Welcome', content: 'Hello', image_url: null, status: 'draft', created_at: '2026-08-18T01:00:00Z', updated_at: '2026-08-18T01:00:00Z' },
  { page_id: 'about', title: 'About Us', subtitle: '', content: 'About content', image_url: null, status: 'published', created_at: '2026-08-18T02:00:00Z', updated_at: '2026-08-18T02:00:00Z' },
]

describe('AdminCMS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCMSContentList.mockResolvedValue(samplePages)
  })

  it('renders the CMS section list', async () => {
    render(<AdminCMS />)

    expect(await screen.findByText('CMS Content')).toBeInTheDocument()
    expect(screen.getAllByText('Home Hero Section').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('About Us').length).toBeGreaterThanOrEqual(1)
  })

  it('displays status badges for each page', async () => {
    render(<AdminCMS />)

    await screen.findByText('CMS Content')
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(1)
  })

  it('opens edit form when clicking Edit', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    expect(await screen.findByText('Edit: Home Hero Section')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Content')).toBeInTheDocument()
  })

  it('saves content after confirmation', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    updateCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    await user.click(screen.getByText('Save Changes'))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('alertdialog').querySelector('button:last-child'))

    expect(updateCMSContent).toHaveBeenCalledWith('home-hero', expect.objectContaining({
      title: 'Home Hero Section',
      status: 'draft',
    }))
  })

  it('toggles status between draft and published', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    const statusSelect = screen.getByLabelText('Status')
    await user.selectOptions(statusSelect, 'published')

    expect(statusSelect).toHaveValue('published')
  })

  it('shows loading state', () => {
    fetchCMSContentList.mockReturnValue(new Promise(() => {}))

    render(<AdminCMS />)

    expect(screen.getByText('Loading content…')).toBeInTheDocument()
  })

  it('shows error state with retry', async () => {
    fetchCMSContentList.mockRejectedValueOnce(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminCMS />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('CMS Content')).toBeInTheDocument()
  })

  it('shows empty state when no pages exist', async () => {
    fetchCMSContentList.mockResolvedValue([])

    render(<AdminCMS />)

    expect(await screen.findByText(/No CMS pages found/)).toBeInTheDocument()
  })

  it('toggles preview mode', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    await user.click(screen.getByText('Preview'))

    expect(screen.getByText('Home Hero Section')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()

    await user.click(screen.getByText('Edit'))
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
  })

  it('navigates back to list', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    await user.click(screen.getByText('← Back'))

    expect(await screen.findByText('CMS Content')).toBeInTheDocument()
  })
})
