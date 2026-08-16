import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SubdivisionMap from './SubdivisionMap.jsx'

const properties = [
  {
    id: 'p1',
    name: 'Andor Ridge',
    type: 'development lot',
    location: 'Batangas City',
    price: 1500000,
    map_pins: [
      { id: 'l1', name: 'Lot A', price: 1800000, lot_area_sqm: 150, x: 25, y: 40 },
      { id: 'l2', name: 'Lot B', price: 2000000, lot_area_sqm: 200, x: 70, y: 15 },
    ],
  },
  {
    id: 'p2',
    name: 'Andor Ridge Extension',
    type: 'residential lot',
    location: 'Lipa',
    price: 1000000,
    map_pins: [{ id: 'l3', name: 'Lot C', price: null, lot_area_sqm: null, x: 10, y: 80 }],
  },
]

const noPins = [
  { id: 'p9', name: 'No Pin', type: 'residential lot', location: 'Tanauan', price: 1000000, map_pins: [] },
]

describe('SubdivisionMap', () => {
  it('renders nothing when no property has pins', () => {
    const { container } = render(<SubdivisionMap properties={noPins} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the map image with one pin per lot', () => {
    render(<SubdivisionMap properties={[...properties, ...noPins]} />)
    expect(screen.getByRole('img', { name: /subdivision map/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /pin on map/i })).toHaveLength(3)
  })

  it('positions pins using lot x/y percentages', () => {
    render(<SubdivisionMap properties={properties} />)
    const pins = screen.getAllByRole('button', { name: /pin on map/i })
    expect(pins[0]).toHaveStyle({ left: '25%', top: '40%' })
    expect(pins[1]).toHaveStyle({ left: '70%', top: '15%' })
  })

  it('calls onSelect with the property id when a pin is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SubdivisionMap properties={properties} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: /Lot B.*pin on map/i }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('shows lot name and price in the tooltip, falling back to the property price', () => {
    render(<SubdivisionMap properties={properties} />)
    expect(screen.getByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,800,000')).toBeInTheDocument()
    expect(screen.getByText('Lot C')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,000,000')).toBeInTheDocument()
  })
})
