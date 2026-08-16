import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SubdivisionMap from './SubdivisionMap.jsx'

const positioned = [
  { id: 'p1', name: 'Andor Ridge Lot A', type: 'residential lot', location: 'Batangas City', price: 1500000, map_x: 25, map_y: 40 },
  { id: 'p2', name: 'Andor Ridge Lot B', type: 'house & lot', location: 'Lipa', price: null, map_x: 70, map_y: 15 },
]

const noPos = [
  { id: 'p3', name: 'Andor Ridge Lot C', type: 'commercial lot', location: 'Tanauan', price: 1000000, map_x: null, map_y: null },
]

describe('SubdivisionMap', () => {
  it('renders nothing when no property has a map position', () => {
    const { container } = render(<SubdivisionMap properties={noPos} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the map image with a pin for each positioned property', () => {
    render(<SubdivisionMap properties={[...positioned, ...noPos]} />)
    expect(screen.getByRole('img', { name: /subdivision map/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /pin on map/i })).toHaveLength(2)
  })

  it('positions pins using map_x/map_y percentages', () => {
    render(<SubdivisionMap properties={positioned} />)
    const pins = screen.getAllByRole('button', { name: /pin on map/i })
    expect(pins[0]).toHaveStyle({ left: '25%', top: '40%' })
    expect(pins[1]).toHaveStyle({ left: '70%', top: '15%' })
  })

  it('calls onSelect with the property id when a pin is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SubdivisionMap properties={positioned} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: /Andor Ridge Lot A.*pin on map/i }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })
})
