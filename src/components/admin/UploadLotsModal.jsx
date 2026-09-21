import { useEffect, useState } from 'react'
import { mapLotRows, readLotsFile, validateLotRows } from '../../lib/excel.js'
import { createLots, fetchProjectLots } from '../../lib/projects.js'

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
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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

  const handleImport = async () => {
    if (!canImport) return
    setImporting(true)
    setError(null)
    try {
      const created = await createLots(project.id, project, rows)
      onImported(created?.length ?? rows.length)
    } catch (err) {
      if (isDuplicateKey(err)) setError('Block/Lot already exists in this project.')
      else setError(err?.message || 'Could not import the lots. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const errorRows = rowNumbersInErrors(errors)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4"
      onClick={importing ? undefined : onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Upload lots"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">Upload Lots</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
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
              accept=".xlsx,.xls"
              aria-label="Lots Excel file"
              onChange={handleFile}
              className="w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-1.5 text-xs text-ink/50">
              Expected columns: Block No, Lot No, Area. {fileName ? `Selected: ${fileName}` : ''}
            </p>
          </div>

          {reading && <p className="text-sm text-ink/60">Reading file…</p>}

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
                    <th className="px-4 py-2">Row</th>
                    <th className="px-4 py-2">Block</th>
                    <th className="px-4 py-2">Lot</th>
                    <th className="px-4 py-2">Area</th>
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
                      <td className="px-4 py-2 text-ink/70">{row.area}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} disabled={importing} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand disabled:opacity-60">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="btn btn-gold disabled:opacity-60"
            >
              {importing ? 'Importing…' : 'Import Lots'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
