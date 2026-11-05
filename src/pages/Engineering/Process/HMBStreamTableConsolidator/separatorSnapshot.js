export function snapshotBasis(request, sources, excluded, overrides, metadata) {
  const ids = new Set(sources.map((source) => source.id))
  return {
    request, sources, metadata,
    excluded: excluded.filter((id) => ids.has(id)),
    overrides: Object.fromEntries(Object.entries(overrides).filter(([key]) =>
      sources.some((source) => key.startsWith(`${source.id}:`)))),
  }
}

export function restoreSeparatorSnapshot(response) {
  const snapshot = response?.snapshot
  const basis = snapshot?.basis
  if (response?.historical !== true || snapshot?.format !== 'radai.separator.snapshot'
      || snapshot?.format_version !== 1 || !basis || !Array.isArray(basis.sources)
      || !Array.isArray(basis.excluded) || !basis.overrides || !basis.metadata
      || !basis.request?.criteria || !snapshot.result || !snapshot.schema
      || snapshot.result.version !== snapshot.calculator_version
      || snapshot.schema.version !== snapshot.calculator_version || !response.archive?.project_id) {
    throw new Error('Saved separator snapshot is invalid or unsupported. No inputs were restored.')
  }
  return {
    archive: response.archive, snapshot,
    criteria: Object.fromEntries(Object.entries(basis.request.criteria).map(([key, val]) => [key, String(val)])),
    sources: basis.sources, excluded: basis.excluded, overrides: basis.overrides, metadata: basis.metadata,
  }
}
