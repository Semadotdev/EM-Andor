import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadLotsModal from './UploadLotsModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/excel.js', () => ({
  readLotsFile: vi.fn(),
  mapLotRows: vi.fn(),
  validateLotRows: vi.fn(),
}))

vi.mock('../../lib/projects.js', () => ({
  fetchProjectLots: vi.fn(),
  createLots: vi.fn(),
  resolveLotPrice: vi.fn(),
}))

import { mapLotRows, readLotsFile, validateLotRows } from '../../lib/excel.js'
import { createLots, fetchProjectLots, resolveLotPrice } from '../../lib/projects.js'

const project = { id: 'pr1', name: 'Andor Farm', address: 'Brgy. Andor', price_per_sqm: 1000 }
const rows = [{ rowNumber: 2, block_no: '1', lot_no: '1', area: 100 }]

const chooseFile = async (user) => {
  const file = new File(['data'], 'lots.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  await user.upload(screen.getByLabelText('Lots Excel file'), file)
}

describe('UploadLotsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readLotsFile.mockResolvedValue([['Block No', 'Lot No', 'Area'], ['1', '1', 100]])
    mapLotRows.mockReturnValue({ rows, errors: [] })
    fetchProjectLots.mockResolvedValue([])
    validateLotRows.mockReturnValue([])
    createLots.mockResolvedValue([{ id: 'p1' }])
    resolveLotPrice.mockReturnValue(100000)
  })

  it('previews a valid file and imports the lots', async () => {
    const onImported = vi.fn()
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={onImported} />)

    expect(screen.getByLabelText('Lots Excel file')).toHaveAttribute('accept', '.xlsx')
    expect(screen.getByText(/Only \.xlsx files are supported\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import Lots' })).toBeDisabled()

    await chooseFile(user)

    expect(await screen.findByText('100')).toBeInTheDocument()
    expect(fetchProjectLots).toHaveBeenCalledWith('pr1')
    expect(validateLotRows).toHaveBeenCalledWith(rows, [])

    const importButton = screen.getByRole('button', { name: 'Import Lots' })
    expect(importButton).toBeEnabled()

    await user.click(importButton)

    expect(createLots).toHaveBeenCalledWith('pr1', project, rows)
    expect(onImported).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Imported 1 lot.')).toBeInTheDocument()
  })

  it('previews the resolved total and unit prices for transparency', async () => {
    const rows = [{ rowNumber: 2, block_no: '1', lot_no: '1', area: 100, price: 750000, price_per_sqm: 7500, lot_location: 'Corner' }]
    mapLotRows.mockReturnValue({ rows, errors: [] })
    resolveLotPrice.mockReturnValue(750000)
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={vi.fn()} />)

    await chooseFile(user)

    expect(await screen.findByText('₱ 750,000')).toBeInTheDocument()
    expect(screen.getByText('₱ 7,500')).toBeInTheDocument()
    expect(screen.getByText('Corner')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Location' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Price/m²' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Price' })).toBeInTheDocument()
  })

  it('paginates the preview when there are more than 10 rows', async () => {
    const manyRows = Array.from({ length: 12 }, (_, i) => ({
      rowNumber: i + 2,
      block_no: '1',
      lot_no: String(i + 1),
      area: 100,
      price_per_sqm: 1000,
    }))
    mapLotRows.mockReturnValue({ rows: manyRows, errors: [] })
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={vi.fn()} />)

    await chooseFile(user)

    expect(await screen.findByText('Showing 1–10 of 12')).toBeInTheDocument()
    expect(within(document.querySelector('table tbody')).getAllByRole('row')).toHaveLength(10)

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(await screen.findByText('Showing 11–12 of 12')).toBeInTheDocument()
    expect(within(document.querySelector('table tbody')).getAllByRole('row')).toHaveLength(2)
  })

  it('disables import and shows row errors for an invalid file', async () => {
    validateLotRows.mockReturnValue(['Row 2: Area must be a number greater than 0.'])
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={vi.fn()} />)

    await chooseFile(user)

    expect(await screen.findByText('Row 2: Area must be a number greater than 0.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import Lots' })).toBeDisabled()
    expect(createLots).not.toHaveBeenCalled()
  })

  it('shows a header error and skips validation when columns are missing', async () => {
    mapLotRows.mockReturnValue({
      rows: [],
      errors: ['Missing column(s): Area. Expected headers: Block No, Lot No, Area.'],
    })
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={vi.fn()} />)

    await chooseFile(user)

    expect(await screen.findByText(/Missing column/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import Lots' })).toBeDisabled()
    expect(fetchProjectLots).not.toHaveBeenCalled()
  })

  it('surfaces a duplicate-key error from the import', async () => {
    createLots.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint "properties_project_block_lot_idx"'), {
        code: '23505',
      }),
    )
    const onImported = vi.fn()
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={onImported} />)

    await chooseFile(user)
    await user.click(await screen.findByRole('button', { name: 'Import Lots' }))

    expect(await screen.findByText('Block/Lot already exists in this project.')).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()
  })

  it('surfaces a file-read failure', async () => {
    readLotsFile.mockRejectedValue(new Error('Could not read the file.'))
    const user = userEvent.setup()

    render(<UploadLotsModal project={project} onClose={vi.fn()} onImported={vi.fn()} />)

    await chooseFile(user)

    expect(await screen.findByText('Could not read the file.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<UploadLotsModal project={project} onClose={onClose} onImported={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
