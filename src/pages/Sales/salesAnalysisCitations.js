export function assessmentCitations(facts, documents, keys, limit = 3) {
  const citations = [];
  const seen = new Set();
  for (const key of keys) {
    for (const fact of Array.isArray(facts?.[key]) ? facts[key] : []) {
      const name = fact?.source_file;
      const location = fact?.source_page;
      if (!name || !location) continue;
      const page = /^Page\s+(\d+)(?:\s*,\s*part\s+\d+)?$/i.exec(location.trim());
      const pageNumber = page ? Number(page[1]) : null;
      const identity = `${fact.source_id || name}:${pageNumber || location}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const document = documents?.[String(fact.source_id)] || {};
      citations.push({
        name,
        location,
        page: pageNumber,
        fileId: document.file_id || '',
        folder: document.folder || '',
        provider: document.provider || '',
      });
      if (citations.length >= limit) return citations;
      break;
    }
  }
  return citations;
}
