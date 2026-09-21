import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { inputClass, Checkbox, FieldError, Input, Select, Textarea } from './Field.jsx'

describe('Field', () => {
  it('binds the label to the input and applies the shared input class', () => {
    render(<Input label="Name" id="name" />)

    const input = screen.getByLabelText('Name')
    expect(input).toHaveAttribute('id', 'name')
    expect(input.className).toContain(inputClass)
  })

  it('merges extra classes with the shared input class', () => {
    render(<Input label="Name" id="name" className="mt-2" />)

    expect(screen.getByLabelText('Name')).toHaveClass('mt-2')
  })

  it('shows the error in a role="alert" paragraph', () => {
    render(<Input label="Name" id="name" error="Name is required." />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Name is required.')
    expect(alert).toHaveClass('text-red-600')
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders no error paragraph without an error', () => {
    render(<Input label="Name" id="name" />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('binds a Select label and options', () => {
    render(
      <Select label="Status" id="status">
        <option value="available">Available</option>
        <option value="sold">Sold</option>
      </Select>,
    )

    expect(screen.getByLabelText('Status')).toHaveClass('w-full')
    expect(screen.getByRole('option', { name: 'Sold' })).toBeInTheDocument()
  })

  it('renders a Textarea with its label', () => {
    render(<Textarea label="Remarks" id="remarks" />)

    expect(screen.getByLabelText('Remarks').tagName).toBe('TEXTAREA')
  })

  it('renders an inline Checkbox bound to its label', () => {
    render(<Checkbox label="Pinned" id="pinned" />)

    const checkbox = screen.getByLabelText('Pinned')
    expect(checkbox).toHaveAttribute('type', 'checkbox')
  })

  it('shows a checkbox error', () => {
    render(<Checkbox label="Pinned" id="pinned" error="Required." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Required.')
  })

  it('renders a standalone FieldError', () => {
    render(<FieldError>Boom</FieldError>)

    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
  })

  it('renders nothing for an empty standalone FieldError', () => {
    const { container } = render(<FieldError>{null}</FieldError>)

    expect(container).toBeEmptyDOMElement()
  })
})
