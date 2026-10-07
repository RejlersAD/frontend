export function classificationState(classification) {
  if (!classification) return 'Unclassified';
  const processing = classification.status === 'queued' || classification.status === 'running';
  if (classification.origin === 'confirmed') return processing ? classification.status === 'queued' ? 'Manual · Queued' : 'Manual · Classifying' : 'Manual';
  if (processing) return classification.status === 'queued' ? 'Queued' : 'Classifying…';
  if (classification.status === 'failed') return 'Failed';
  if (classification.status === 'blocked') return 'Unavailable';
  if (classification.origin === 'ai') return 'Automatic suggestion';
  if (classification.origin === 'rule') return 'Auto';
  return 'Unclassified';
}

export function classificationTone(color) {
  if (color === 'violet') return 'purple';
  if (color === 'emerald') return 'green';
  return ['blue', 'purple', 'green', 'amber', 'orange', 'red', 'teal', 'cyan', 'indigo', 'slate', 'gray', 'pink'].includes(color) ? color : 'gray';
}

export function verifiedClassification(value) {
  return value && typeof value.document_type === 'string' && typeof value.label === 'string' && Number.isInteger(value.revision) && value.revision >= 0;
}

export function patchDocument(files, result) {
  if (result?._deleted) {
    const remaining = files.filter(file => file.id !== result.id);
    if (!result.current) return remaining;
    const current = result.current;
    const index = remaining.findIndex(file => file.id === current.id);
    if (index < 0) return [current, ...remaining];
    const next = [...remaining];
    const classification = next[index].classification?.revision > current.classification?.revision
      ? next[index].classification
      : current.classification || next[index].classification;
    next[index] = { ...next[index], ...current, classification };
    return next;
  }
  let matched = false;
  const next = files.map(file => {
    if (file.id === result.id) {
      matched = true;
      const classification = file.classification?.revision > result.classification?.revision
        ? file.classification
        : result.classification || file.classification;
      return { ...file, ...result, classification };
    }
    return file;
  });
  return matched ? next : [result, ...files];
}

export function commandIdentity(previous, payload) {
  const key = JSON.stringify(payload);
  return previous?.key === key ? previous : { key, requestId: globalThis.crypto.randomUUID() };
}
