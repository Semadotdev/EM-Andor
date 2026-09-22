import { readSheet } from 'read-excel-file/browser'

const HEADER_ALIASES = {
  block_no: ['block no', 'block', 'blk no', 'blk no.', 'blk', 'block number'],
  lot_no: ['lot no', 'lot', 'lot number'],
  area: ['area', 'area (sqm)', 'area sqm', 'sqm', 'lot area', 'lot size'],
  price: ['price', 'total price', 'total', 'lot price'],
  price_per_sqm: ['price per sqm', 'price per m2', 'price per m²', 'price per square meter', 'price/sqm', 'unit price'],
  lot_location: ['lot location', 'location'],
}

const REQUIRED_FIELDS = ['block_no', 'lot_no', 'area']

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const parseCell = (raw, { allowEmpty = false } = {}) => {
  const text = String(raw ?? '').trim()
  if (allowEmpty && text === '') return undefined
  return typeof raw === 'number' ? raw : Number(text)
}

export function mapLotRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return { rows: [], errors: ['The file is empty.'] }

  const header = (rawRows[0] ?? []).map(normalize)
  const index = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    index[field] = header.findIndex((h) => aliases.includes(h))
  }
  const missing = REQUIRED_FIELDS.filter((field) => index[field] === -1).map((field) => field)
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [`Missing column(s): ${missing.map((f) => HEADER_ALIASES[f][0]).join(', ')}. Expected headers: Block No, Lot No, Area.`],
    }
  }

  const rows = []
  for (let i = 1; i < rawRows.length; i++) {
    const raw = rawRows[i] ?? []
    const blockRaw = raw[index.block_no]
    const lotRaw = raw[index.lot_no]
    const areaRaw = raw[index.area]
    if (String(blockRaw ?? '').trim() === '' && String(lotRaw ?? '').trim() === '' && String(areaRaw ?? '').trim() === '') continue

    const row = {
      rowNumber: i + 1,
      block_no: String(blockRaw ?? '').trim(),
      lot_no: String(lotRaw ?? '').trim(),
      area: parseCell(areaRaw),
    }
    if (index.price !== -1) row.price = parseCell(raw[index.price], { allowEmpty: true })
    if (index.price_per_sqm !== -1) row.price_per_sqm = parseCell(raw[index.price_per_sqm], { allowEmpty: true })
    if (index.lot_location !== -1) {
      const location = String(raw[index.lot_location] ?? '').trim()
      if (location !== '') row.lot_location = location
    }
    rows.push(row)
  }
  return { rows, errors: [] }
}

export function validateLotRows(rows, existingKeys = []) {
  const errors = []
  const seen = new Set(existingKeys.map((k) => `${normalize(k.block_no)}|${normalize(k.lot_no)}`))
  for (const row of rows) {
    if (!row.block_no) errors.push(`Row ${row.rowNumber}: Block No is required.`)
    if (!row.lot_no) errors.push(`Row ${row.rowNumber}: Lot No is required.`)
    if (!Number.isFinite(row.area) || row.area <= 0) errors.push(`Row ${row.rowNumber}: Area must be a number greater than 0.`)
    for (const [field, label] of [['price', 'Price'], ['price_per_sqm', 'Price per m²']]) {
      const value = row[field]
      if (value === undefined) continue
      if (!Number.isFinite(value)) errors.push(`Row ${row.rowNumber}: ${label} must be a number.`)
      else if (value <= 0) errors.push(`Row ${row.rowNumber}: ${label} must be greater than 0.`)
    }
    const key = `${normalize(row.block_no)}|${normalize(row.lot_no)}`
    if (row.block_no && row.lot_no && seen.has(key)) {
      errors.push(`Row ${row.rowNumber}: Block ${row.block_no} Lot ${row.lot_no} is duplicated.`)
    }
    seen.add(key)
  }
  return errors
}

export async function readLotsFile(file) {
  return readSheet(file)
}
