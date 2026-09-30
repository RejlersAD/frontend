const incomplete = () => new Error('Attendance corrections could not be loaded completely. Please retry.')

// Corrections affect totals, so publish them only after every page succeeds.
export const loadAttendanceOverrides = async fetchPage => {
  const records = []
  let expectedCount
  for (let page = 1; page <= 1000; page++) {
    const data = await fetchPage(page)
    if (page === 1 && Array.isArray(data)) return data
    if (!data || !Array.isArray(data.results) || !Number.isSafeInteger(data.count) ||
        data.count < 0 || !Object.hasOwn(data, 'next')) throw incomplete()
    if (page === 1) expectedCount = data.count
    if (data.count !== expectedCount) throw incomplete()
    records.push(...data.results)
    if (records.length > expectedCount) throw incomplete()
    if (data.next === null) {
      if (records.length !== expectedCount) throw incomplete()
      return records
    }
    if (typeof data.next !== 'string' || !data.results.length) throw incomplete()
    let nextPage
    try {
      // Only use the page number; requests keep the original endpoint/filters.
      nextPage = Number(new URL(data.next, 'https://attendance.invalid/').searchParams.get('page'))
    } catch { throw incomplete() }
    if (!Number.isSafeInteger(nextPage) || nextPage !== page + 1) throw incomplete()
  }
  throw incomplete()
}
