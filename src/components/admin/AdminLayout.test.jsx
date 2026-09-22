import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLayout from './AdminLayout.jsx'

vi.mock('../shared/Logo.jsx', () => ({
  default: () => <span aria-label="E.M. Andor — home">Logo</span>,
}))

vi.mock('../../lib/agents.js', () => ({
  fetchCurrentAgent: vi.fn(),
  fetchMyDownline: vi.fn(),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>IndexPage</p>} />
          <Route path="projects" element={<p>ProjectsPage</p>} />
        </Route>
        <Route path="/admin/login" element={<p>LoginPage</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fireInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(event)
  return event
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    fetchCurrentAgent.mockResolvedValue({ id: 'admin1', name: 'Admin', role: 'admin', is_active: true })
    fetchMyDownline.mockResolvedValue([])
  })

  it('redirects to /admin/login when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderLayout()

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('renders the matched page through the outlet', async () => {
    renderLayout()

    expect(await screen.findByText('IndexPage')).toBeInTheDocument()
  })

  it('renders the admin nav with every group and section', async () => {
    renderLayout()

    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin')
    const groups = {
      Sales: ['Projects', 'Agents', 'Commissions'],
      Inbox: ['Inquiries', 'Notifications'],
      Content: ['CMS'],
      System: ['Activity Log'],
    }

    for (const [group, items] of Object.entries(groups)) {
      expect(within(nav).getByText(group)).toBeInTheDocument()
      for (const label of items) {
        expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
      }
    }
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/admin/projects')
  })

  it('renders the agent nav with only agent items', async () => {
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })
    fetchMyDownline.mockResolvedValue([{ id: 'a2', name: 'Rico', role: 'sub_agent' }])

    renderLayout()

    const nav = await screen.findByRole('navigation', { name: 'Agent sections' })
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin')
    for (const label of ['Available Lots', 'My Sales', 'My Commissions', 'My Downline']) {
      expect(await within(nav).findByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument()
  })

  it('hides the downline link when the agent has no downline', async () => {
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })
    fetchMyDownline.mockResolvedValue([])

    renderLayout()

    await screen.findByRole('navigation', { name: 'Agent sections' })
    expect(screen.queryByRole('link', { name: 'My Downline' })).not.toBeInTheDocument()
  })

  it('shows the agent name and role in the header and signs out', async () => {
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana Cruz', role: 'sub_agent', is_active: true })
    const user = userEvent.setup()

    renderLayout()

    expect(await screen.findByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByText('Sub Agent')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('shows the not-linked screen with sign out when no agent profile exists', async () => {
    fetchCurrentAgent.mockRejectedValue(new Error('no profile'))
    const user = userEvent.setup()

    renderLayout()

    expect(await screen.findByText(/not linked to an agent profile/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('keeps the logo desktop-only in the header and shows it in the mobile drawer with sign out', async () => {
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana Cruz', role: 'sub_agent', is_active: true })
    const user = userEvent.setup()

    renderLayout()

    await screen.findByText('IndexPage')

    const headerLogo = screen.getByLabelText('E.M. Andor — home')
    expect(headerLogo.closest('.hidden')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    const drawer = screen.getByRole('dialog', { name: 'Navigation' })
    expect(within(drawer).getByLabelText('E.M. Andor — home')).toBeInTheDocument()
    expect(within(drawer).getByText('Ana Cruz')).toBeInTheDocument()
    expect(within(drawer).getByText('Sub Agent')).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Sign out' }))
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('toggles the mobile navigation drawer', async () => {
    const user = userEvent.setup()

    renderLayout()

    await screen.findByText('IndexPage')
    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    expect(screen.getAllByRole('navigation', { name: 'Admin sections' })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Close navigation' }))

    expect(screen.getAllByRole('navigation', { name: 'Admin sections' })).toHaveLength(1)
  })

  it('redirects to login when the auth listener reports no session', async () => {
    renderLayout()

    await screen.findByText('IndexPage')
    const listener = supabase.auth.onAuthStateChange.mock.calls[0][0]
    await act(async () => {
      listener('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(screen.getByText('LoginPage')).toBeInTheDocument()
    })
  })

  it('shows Install app and prompts when the browser offers an install', async () => {
    renderLayout()

    await screen.findByText('IndexPage')
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()

    let event
    await act(async () => {
      event = fireInstallPrompt()
    })

    const button = await screen.findByRole('button', { name: 'Install app' })
    const user = userEvent.setup()
    await user.click(button)

    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument(),
    )
  })

  it('never shows Install app when the browser offers nothing', async () => {
    renderLayout()

    await screen.findByText('IndexPage')
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
  })
})
