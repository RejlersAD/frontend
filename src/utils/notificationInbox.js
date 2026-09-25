const MAX_PAGES = 1000

const invalidInbox = () => Object.assign(new Error('Invalid notification pages'), {
  notificationMessage: 'The complete notification inbox could not be loaded. Please retry.',
})

const checkAborted = signal => {
  if (signal?.aborted) throw new DOMException('Notification refresh cancelled', 'AbortError')
}

const readPage = data => {
  if (Array.isArray(data)) return { rows: data, next: null, count: undefined }
  if (!data || !Array.isArray(data.results)) throw invalidInbox()
  if (data.count !== undefined && (!Number.isSafeInteger(data.count) || data.count < 0)) throw invalidInbox()
  if (data.count !== undefined && !Object.hasOwn(data, 'next')) throw invalidInbox()
  if (data.next != null && (typeof data.next !== 'string' || !data.next.trim())) throw invalidInbox()
  return { rows: data.results, next: data.next, count: data.count }
}

const nextPageNumber = (next, currentPage) => {
  try {
    const page = Number(new URL(next, 'https://notification-inbox.invalid/').searchParams.get('page'))
    if (Number.isSafeInteger(page) && page === currentPage + 1 && page <= MAX_PAGES) return page
  } catch { /* Reject malformed links without following an arbitrary URL. */ }
  throw invalidInbox()
}

/**
 * Read every linked page. DRF count and rows are separate database reads, so
 * count is advisory while an inbox receives deliveries or deletions. Refresh
 * once after drift; a second valid traversal remains usable even if it changed
 * again. Failed requests and malformed pagination still reject atomically.
 */
export const loadNotificationInbox = async (fetchPage, { signal } = {}) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const records = new Map()
    let page = 1
    let firstCount
    let changed = false
    while (true) {
      checkAborted(signal)
      const response = await fetchPage(page)
      checkAborted(signal)
      const { rows, next, count } = readPage(response)
      if (page === 1) firstCount = count
      else if (count !== undefined && firstCount !== undefined && count !== firstCount) changed = true
      for (const row of rows) {
        if (!row || !['number', 'string'].includes(typeof row.id) || String(row.id).trim() === '') throw invalidInbox()
        const key = String(row.id)
        if (records.has(key)) changed = true
        records.set(key, row)
      }
      if (!next) break
      if (!rows.length) throw invalidInbox()
      page = nextPageNumber(next, page)
    }
    if (firstCount !== undefined && records.size !== firstCount) changed = true
    if (!changed || attempt === 1) return [...records.values()]
  }
}
