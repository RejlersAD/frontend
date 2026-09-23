// Older PRs store project labels rather than separate code fields. Recognize
// complete seven-digit project numbers, not shorter package/plant references.
const legacyProjectNumbers = value => [...String(value || '').matchAll(/(?:^|[^A-Za-z0-9])(\d{7})(?![A-Za-z0-9])/g)].map(match => match[1]);

/** Prefer explicit codes and retain the numbered references in older PR labels. */
export function requisitionProjectNumbers(requisition) {
  const details = Array.isArray(requisition?.project_details) ? requisition.project_details : [];
  const seen = new Set();
  let numbers = details.flatMap(detail => {
    const number = String(detail?.project_number || detail?.project_code || detail?.code || '').trim();
    return number ? [number] : legacyProjectNumbers(detail?.value || detail?.label);
  });
  if (!numbers.length) numbers = legacyProjectNumbers(requisition?.project_department || requisition?.project);
  return numbers.filter(number => {
    if (seen.has(number.toLowerCase())) return false;
    seen.add(number.toLowerCase());
    return true;
  });
}

export function requisitionProjectReference(requisition) {
  return requisitionProjectNumbers(requisition).join(', ')
    || String(requisition?.project || requisition?.project_department || '').trim();
}

export function projectNumbersForSelection(requisition, selectedNumber) {
  const numbers = requisitionProjectNumbers(requisition);
  const selected = String(selectedNumber || '').trim();
  return numbers.length > 1 && numbers.some(number => number.toLowerCase() === selected.toLowerCase())
    ? numbers.join(', ') : selected;
}

/** Keep the recorded list authoritative; directory lookups only add labels/IDs. */
export function purchaseOrderProjectSelections(formData, projects = []) {
  const saved = Array.isArray(formData.contact_persons?.project_selections)
    ? formData.contact_persons.project_selections : [];
  const seen = new Set();
  return String(formData.project_number || '').split(',').map(number => number.trim()).filter(number => {
    if (!number || seen.has(number.toLowerCase())) return false;
    seen.add(number.toLowerCase());
    return true;
  }).map(project_number => {
    const matches = project => String(project.project_number || '').toLowerCase() === project_number.toLowerCase();
    const stored = saved.find(matches);
    const project = projects.find(matches);
    return {
      ...stored,
      project_number,
      project_name: project?.project_name || stored?.project_name || '',
      project_id: project?.source === 'core' ? null : project?.id ?? stored?.project_id ?? null,
      enterprise_project: project?.enterprise_project ?? (project?.source === 'core' ? project.source_project_id : stored?.enterprise_project) ?? null,
    };
  });
}

export function withPurchaseOrderProjects(formData, selections) {
  const seen = new Set();
  const selected = selections.filter(project => {
    const key = project.project_number.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const primary = selected.find(project => project.project_id && String(project.project_id) === String(formData.project))
    || selected.find(project => project.enterprise_project && String(project.enterprise_project) === String(formData.enterprise_project))
    || selected.find(project => project.project_id || project.enterprise_project);
  return {
    ...formData,
    project_number: selected.map(project => project.project_number.trim()).join(', '),
    project: primary?.project_id || '',
    enterprise_project: primary?.enterprise_project ?? null,
    contact_persons: { ...(formData.contact_persons || {}), project_selections: selected },
  };
}
