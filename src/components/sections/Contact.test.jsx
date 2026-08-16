import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Contact from './Contact.jsx'

vi.mock('../../lib/api.js', () => ({
  submitInquiry: vi.fn(),
}))

import { submitInquiry } from '../../lib/api.js'

describe('Contact form', () => {
  beforeEach(() => {
    submitInquiry.mockReset()
  })

  it('submits a valid inquiry to the database and shows a success message', async () => {
    submitInquiry.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<Contact />)

    await user.type(screen.getByLabelText('Full Name'), 'Juan Dela Cruz')
    await user.type(screen.getByLabelText('Email Address'), 'juan@example.com')
    await user.type(screen.getByLabelText('Phone Number'), '09171234567')
    await user.selectOptions(screen.getByLabelText('Project Type'), 'Residential Construction')
    await user.type(screen.getByLabelText('Message'), 'I want to build a house.')
    await user.click(screen.getByRole('button', { name: 'Submit Inquiry' }))

    expect(submitInquiry).toHaveBeenCalledWith({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      phone: '09171234567',
      project_type: 'Residential Construction',
      message: 'I want to build a house.',
    })
    expect(await screen.findByText(/Thank you!/)).toBeInTheDocument()
  })

  it('does not submit when validation fails', async () => {
    const user = userEvent.setup()

    render(<Contact />)

    await user.click(screen.getByRole('button', { name: 'Submit Inquiry' }))

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(await screen.findByText(/Please enter your full name/i)).toBeInTheDocument()
  })

  it('shows an error message when submission fails', async () => {
    submitInquiry.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<Contact />)

    await user.type(screen.getByLabelText('Full Name'), 'Juan Dela Cruz')
    await user.type(screen.getByLabelText('Email Address'), 'juan@example.com')
    await user.type(screen.getByLabelText('Phone Number'), '09171234567')
    await user.type(screen.getByLabelText('Message'), 'I want to build a house.')
    await user.click(screen.getByRole('button', { name: 'Submit Inquiry' }))

    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument()
  })
})
