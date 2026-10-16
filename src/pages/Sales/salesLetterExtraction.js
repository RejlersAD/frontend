const fields = {
  recipient_name: 'Contact name', recipient_title: 'Position', recipient_company: 'Company',
  recipient_email: 'Email', recipient_address: 'Address', your_ref: 'Email reference',
};

export function letterExtractionStatus(letter) {
  const extraction = letter?.custom_data?.letter_extraction;
  if (!extraction?.source || !Array.isArray(extraction.fields)) {
    return 'This letter uses saved recipient details; no extraction source is recorded.';
  }
  const detected = Object.keys(fields).filter(key => extraction.fields.includes(key)
    && (!extraction.values || Boolean(extraction.values[key])));
  const missing = Object.keys(fields).filter(key => !detected.includes(key));
  const origin = extraction.source;
  const source = origin.name
    ? `"${origin.name}"${origin.version ? ` (document version ${origin.version})` : ''}`
    : origin.upload_id ? `uploaded correspondence (${origin.upload_id})` : 'linked email';
  const retained = (extraction.retained_fields || []).filter(key => fields[key]);
  const reference = extraction.values?.your_ref;
  return `Detected in ${source}: ${detected.map(key => fields[key]).join(', ') || 'no contact fields'}.`
    + (missing.length ? ` Not found in the source: ${missing.map(key => fields[key]).join(', ')}.` : '')
    + (retained.length ? ` Saved overrides retained: ${retained.map(key => fields[key]).join(', ')}; review against the current source.` : '')
    + (reference ? ` Source reference: ${reference}.` : '')
    + ' Your edits are preserved.';
}
