export function noGoBrief(reason, scope) {
  const text = String(reason || '').replace(/\s+/g, ' ').trim();
  const uncertain = '(?:insufficient|unconfirmed|unclear|not established|does not (?:currently )?provide sufficient)';
  const commercial = new RegExp(`${uncertain}.{0,70}commercial|commercial.{0,70}${uncertain}`, 'i').test(text);
  const strategic = new RegExp(`${uncertain}.{0,70}strategic|strategic.{0,70}${uncertain}`, 'i').test(text);
  const capacity = /(?:resource|staffing|manpower|specialist|proposal capacity).{0,70}(?:constraint|shortage|unavailable|limited|unconfirmed|protects margin|protects focus)|(?:constraint|shortage|unavailable|limited).{0,70}(?:resource|staffing|manpower|specialist)/i.test(text);

  let rationale = 'Sales has recorded a No-Go decision for this opportunity.';
  if (commercial && strategic) rationale = 'The available information does not establish a sufficient commercial or strategic case to justify a bid.';
  else if (commercial) rationale = 'The commercial case remains unconfirmed, so the opportunity is not recommended for bidding.';
  else if (strategic) rationale = 'The strategic return is not sufficiently established to justify a bid.';
  else if (capacity) rationale = 'The recorded resource or proposal-capacity constraints do not support a bid at this stage.';

  const scopeText = String(scope || '').trim();
  const tenderContext = scopeText.startsWith('The opportunity centers on ')
    ? `${scopeText}${(scopeText.match(/,/g) || []).length >= 2 ? ' The breadth of work would require coordinated specialist delivery.' : ''}`
    : '';
  const nextAction = 'Do not submit a bid. Retain the opportunity for market intelligence and relationship tracking; revisit if the decision grounds materially change.';
  return { rationale, tenderContext, nextAction };
}
