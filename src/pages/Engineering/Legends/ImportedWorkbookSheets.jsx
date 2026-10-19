import React, { useEffect, useState } from 'react'
import { utils } from 'xlsx'
import { getSymbolImages } from '../../../services/pidCheckerV2API'

export default function ImportedWorkbookSheets({ sheets, projectId, section }) {
  const [images, setImages] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [failedImages, setFailedImages] = useState({})

  useEffect(() => {
    setImages({})
    setError('')
    setFailedImages({})
    setLoading(false)
    if (!sheets?.some(sheet => sheet.images?.length) || !projectId) return
    let live = true
    setLoading(true)
    getSymbolImages(projectId).then(result => {
      if (!live) return
      setImages(Object.fromEntries(
        (result.images || []).filter(image => image.section === section)
          .map(image => [image.symbol_name, image.image_url]),
      ))
    }).catch(err => {
      if (live) setError(err?.response?.data?.error || 'Could not load imported symbol pictures. Reopen the section to retry.')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [sheets, projectId, section])

  if (!sheets?.length) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-800">Imported worksheets — text and symbols</h2>
      <p className="text-xs text-slate-500 mt-1 mb-3">
        {sheets.length} worksheets in this section. Pictures stay alongside the text at their original row and column.
      </p>
      {loading && <p role="status" className="text-xs text-slate-500">Loading symbol pictures…</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {sheets.map(sheet => {
        const pictures = new Map()
        const mergedCells = new Map()
        for (const range of sheet.merged_ranges || []) {
          const { s, e } = utils.decode_range(range)
          for (let row = s.r; row <= e.r; row++) {
            for (let column = s.c; column <= e.c; column++) {
              mergedCells.set(`${row}:${column}`, row === s.r && column === s.c
                ? { rowSpan: e.r - s.r + 1, colSpan: e.c - s.c + 1 } : null)
            }
          }
        }
        for (const image of sheet.images || []) {
          const key = `${image.row}:${image.column}`
          pictures.set(key, [...(pictures.get(key) || []), image])
        }
        return (
          <details key={sheet.name} className="mt-3 rounded-lg border border-slate-200">
            <summary className="cursor-pointer p-3 text-sm font-semibold text-slate-700">
              {sheet.name} · {sheet.rows.length} rows · {sheet.images?.length || 0} symbols
            </summary>
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {sheet.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((value, columnIndex) => mergedCells.get(`${rowIndex}:${columnIndex}`) === null ? null : (
                        <td key={columnIndex} {...mergedCells.get(`${rowIndex}:${columnIndex}`)}
                          className="border border-slate-200 p-2 align-middle"
                          style={{ minWidth: 110, maxWidth: 400, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {value}
                          {(pictures.get(`${rowIndex + 1}:${columnIndex + 1}`) || []).map(image => {
                            const url = image.data_url || images[image.name]
                            return (
                              <figure key={image.path} className="my-2">
                                {url && !failedImages[image.path] ? (
                                  <img src={url} alt={image.name} loading="lazy"
                                    className="h-24 w-36 object-contain bg-white"
                                    onError={() => setFailedImages(prev => ({ ...prev, [image.path]: true }))} />
                                ) : (
                                  <p className="text-red-600">
                                    {loading ? 'Loading…' : 'Picture unavailable — select the import project or retry loading.'}
                                  </p>
                                )}
                                <figcaption className="mt-1 text-slate-500">{image.name}</figcaption>
                              </figure>
                            )
                          })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </section>
  )
}

