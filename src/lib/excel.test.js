import { describe, expect, it } from 'vitest'
import { mapLotRows, validateLotRows } from './excel.js'

const header = ['Block No', 'Lot No', 'Area']

const row = (overrides = {}) => ({ rowNumber: 2, block_no: '1', lot_no: '2', area: 100, ...overrides })

describe('mapLotRows', () => {
  it('maps canonical headers and trims values', () => {
    const { rows, errors } = mapLotRows([header, [' 1 ', '7', '120.5']])

    expect(errors).toEqual([])
    expect(rows).toEqual([{ rowNumber: 2, block_no: '1', lot_no: '7', area: 120.5 }])
  })

  it.each([
    [[' blk ', 'lot', 'area (sqm)']],
    [['block', 'Lot No', 'Area']],
    [['Block Number', 'lot number', 'sqm']],
  ])('accepts header aliases: %j', (aliases) => {
    const { rows, errors } = mapLotRows([aliases, ['3', '9', 80]])

    expect(errors).toEqual([])
    expect(rows).toEqual([{ rowNumber: 2, block_no: '3', lot_no: '9', area: 80 }])
  })

  it('errors on an empty file', () => {
    expect(mapLotRows([])).toEqual({ rows: [], errors: ['The file is empty.'] })
    expect(mapLotRows(undefined)).toEqual({ rows: [], errors: ['The file is empty.'] })
  })

  it('errors when a required column is missing', () => {
    expect(mapLotRows([['Block No', 'Area'], ['1', 100]])).toEqual({
      rows: [],
      errors: ['Missing column(s): lot no. Expected headers: Block No, Lot No, Area.'],
    })
  })

  it('lists every missing column', () => {
    expect(mapLotRows([['Foo', 'Bar']]).errors).toEqual([
      'Missing column(s): block no, lot no, area. Expected headers: Block No, Lot No, Area.',
    ])
  })

  it('skips blank rows and keeps true row numbers', () => {
    const { rows, errors } = mapLotRows([header, ['', '', ''], [null, undefined, '   '], ['3', '9', 80]])

    expect(errors).toEqual([])
    expect(rows).toEqual([{ rowNumber: 4, block_no: '3', lot_no: '9', area: 80 }])
  })

  it('keeps non-numeric areas so validation can flag them', () => {
    const { rows } = mapLotRows([header, ['4', '2', 'abc']])

    expect(rows).toHaveLength(1)
    expect(rows[0].area).toBeNaN()
  })
})

describe('validateLotRows', () => {
  it('returns no errors for valid rows', () => {
    const rows = [row(), row({ rowNumber: 3, lot_no: '3', area: 50 })]

    expect(validateLotRows(rows)).toEqual([])
  })

  it('requires block and lot numbers', () => {
    expect(validateLotRows([row({ block_no: '', lot_no: '' })])).toEqual([
      'Row 2: Block No is required.',
      'Row 2: Lot No is required.',
    ])
  })

  it('rejects non-numeric, zero, and negative areas', () => {
    const rows = [
      row({ rowNumber: 2, lot_no: '2', area: NaN }),
      row({ rowNumber: 3, lot_no: '3', area: 0 }),
      row({ rowNumber: 4, lot_no: '4', area: -5 }),
    ]

    expect(validateLotRows(rows)).toEqual([
      'Row 2: Area must be a number greater than 0.',
      'Row 3: Area must be a number greater than 0.',
      'Row 4: Area must be a number greater than 0.',
    ])
  })

  it('rejects in-file duplicates regardless of case', () => {
    const rows = [
      row({ rowNumber: 2, block_no: 'A', lot_no: '1', area: 100 }),
      row({ rowNumber: 3, block_no: 'a', lot_no: '1', area: 120 }),
    ]

    expect(validateLotRows(rows)).toEqual(['Row 3: Block a Lot 1 is duplicated.'])
  })

  it('rejects duplicates against existing keys', () => {
    const existing = [{ block_no: ' A ', lot_no: 'b' }]
    const rows = [
      row({ rowNumber: 2, block_no: 'a', lot_no: 'b', area: 100 }),
      row({ rowNumber: 3, block_no: 'a', lot_no: 'c', area: 100 }),
    ]

    expect(validateLotRows(rows, existing)).toEqual(['Row 2: Block a Lot b is duplicated.'])
  })

  it('does not flag blank block/lot rows as duplicates', () => {
    const rows = [
      row({ rowNumber: 2, block_no: '', lot_no: '' }),
      row({ rowNumber: 3, block_no: '', lot_no: '' }),
    ]

    expect(validateLotRows(rows)).toEqual([
      'Row 2: Block No is required.',
      'Row 2: Lot No is required.',
      'Row 3: Block No is required.',
      'Row 3: Lot No is required.',
    ])
  })
})
