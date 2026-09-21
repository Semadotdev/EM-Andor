import { readSheet } from 'read-excel-file/browser'

const HEADER_ALIASES = {
  block_no: ['block no', 'block', 'blk no', 'blk', 'block number'],
  lot_no: ['lot no', 'lot', 'lot number'],
  area: ['area', 'area (sqm)', 'area sqm', 'sqm'],
}

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export function mapLotRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return { rows: [], errors: ['The file is empty.'] }

  const header = (rawRows[0] ?? []).map(normalize)
  const index = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    index[field] = header.findIndex((h) => aliases.includes(h))
  }
  const missing = Object.entries(index).filter(([, i]) => i === -1).map(([field]) => field)
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
    const area = typeof areaRaw === 'number' ? areaRaw : Number(String(areaRaw ?? '').trim())
    rows.push({
      rowNumber: i + 1,
      block_no: String(blockRaw ?? '').trim(),
      lot_no: String(lotRaw ?? '').trim(),
      area,
    })
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
