import { useState } from 'react'
import { mapLotRows, readLotsFile, validateLotRows } from '../../lib/excel.js'
import { createLots, fetchProjectLots, resolveLotPrice } from '../../lib/projects.js'
import { formatPrice } from '../../lib/format.js'
import { Button, LoadingState, Modal, inputClass, useToast } from '../shared/ui'

const isDuplicateKey = (err) =>
  err?.code === '23505' || String(err?.message ?? '').includes('duplicate key')

const rowNumbersInErrors = (errors) => {
  const rows = new Set()
  for (const message of errors) {
    const match = /^Row (\d+):/.exec(message)
    if (match) rows.add(Number(match[1]))
  }
  return rows
}

export default function UploadLotsModal({ project, onClose, onImported }) {
  const { showToast } = useToast()
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setRows([])
    setErrors([])
    setError(null)
    setReading(true)
    try {
      const raw = await readLotsFile(file)
      const mapped = mapLotRows(raw)
      if (mapped.errors.length > 0) {
        setErrors(mapped.errors)
        return
      }
      const existing = await fetchProjectLots(project.id)
      setRows(mapped.rows)
      setErrors(validateLotRows(mapped.rows, existing))
    } catch (err) {
      setError(err?.message || 'Could not read the file. Please try again.')
    } finally {
      setReading(false)
    }
  }

  const canImport = rows.length > 0 && errors.length === 0 && !reading && !importing

  const previewUnit = (row) => {
    if (row.price_per_sqm !== undefined && Number.isFinite(row.price_per_sqm)) return row.price_per_sqm
    const price = resolveLotPrice(row, project)
    if (price !== undefined && Number.isFinite(row.area) && row.area > 0) return Math.round((price / row.area) * 100) / 100
    return undefined
  }

  const handleImport = async () => {
    if (!canImport) return
    setImporting(true)
    setError(null)
    try {
      const created = await createLots(project.id, project, rows)
      const count = created?.length ?? rows.length
      showToast(`Imported ${count} lot${count === 1 ? '' : 's'}.`)
      onImported(count)
    } catch (err) {
      if (isDuplicateKey(err)) setError('Block/Lot already exists in this project.')
      else setError(err?.message || 'Could not import the lots. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const errorRows = rowNumbersInErrors(errors)

  return (
    <Modal open onClose={onClose} label="Upload lots" size="lg" busy={importing}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Upload Lots</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={importing}
          className="rounded-md px-2 py-1 text-ink/50 transition-colors hover:text-ink disabled:opacity-60"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-5">
        <div>
          <label htmlFor="ul-file" className="mb-1.5 block text-sm font-semibold text-brand-deep">
            Excel File
          </label>
          <input
            id="ul-file"
            type="file"
            accept=".xlsx"
            aria-label="Lots Excel file"
            onChange={handleFile}
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand`}
          />
          <p className="mt-1.5 text-xs text-ink/50">
            Expected columns: Block No, Lot No, Area. Optional: Price, Price per m², Lot Location. Only .xlsx files are supported.{fileName ? ` Selected: ${fileName}` : ''}
          </p>
        </div>

        {reading && <LoadingState label="Reading file…" />}

        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-mist">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
                <tr>
                  <th scope="col" className="px-4 py-2">Row</th>
                  <th scope="col" className="px-4 py-2">Block</th>
                  <th scope="col" className="px-4 py-2">Lot</th>
                  <th scope="col" className="px-4 py-2">Location</th>
                  <th scope="col" className="px-4 py-2">Area</th>
                  <th scope="col" className="px-4 py-2">Price/m²</th>
                  <th scope="col" className="px-4 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`border-b border-mist/70 last:border-0 ${errorRows.has(row.rowNumber) ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-2 text-ink/50">{row.rowNumber}</td>
                    <td className="px-4 py-2 font-semibold text-brand-deep">{row.block_no || '—'}</td>
                    <td className="px-4 py-2 text-ink/70">{row.lot_no || '—'}</td>
                    <td className="px-4 py-2 text-ink/50">{row.lot_location || '—'}</td>
                    <td className="px-4 py-2 text-ink/70">{row.area}</td>
                    <td className="px-4 py-2 text-ink/70">{formatPrice(previewUnit(row)) ?? '—'}</td>
                    <td className="px-4 py-2 text-ink/70">{formatPrice(resolveLotPrice(row, project)) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {importing ? 'Importing…' : 'Import Lots'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
