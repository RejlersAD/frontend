export function buildReceivingBasis(basis, drafts, currency = '') {
  if (!['quantity', 'service_value'].includes(basis)) throw new Error('Select Goods or Services.');
  const service = basis === 'service_value';
  if (!Array.isArray(drafts) || !drafts.length || drafts.length > 100 || (service && drafts.length !== 1)) throw new Error(service ? 'Enter one service scope.' : 'Enter between 1 and 100 goods lines.');
  const lines = drafts.map((draft, index) => {
    const description = String(draft.description || '').trim();
    const uom = String(draft.uom || '').trim();
    const ordered = String(draft.ordered || '').trim();
    if (!description || description.length > 2000) throw new Error(`Enter the ${service ? 'service scope' : `description for line ${index + 1}`}.`);
    if (!uom || uom.length > 30) throw new Error(`Enter the unit for line ${index + 1}.`);
    if (service && (!/^[A-Z]{3}$/.test(uom) || uom !== String(currency).trim().toUpperCase())) throw new Error('Use the purchase order currency for the service value.');
    if (!/^\d{1,18}(?:\.\d{1,6})?$/.test(ordered) || !/[1-9]/.test(ordered)) throw new Error(`Enter a positive ${service ? 'net service value' : `ordered quantity for line ${index + 1}`}.`);
    if (service && /[1-9]/.test(ordered.split('.')[1]?.slice(2) || '')) throw new Error('Net service value must use at most two decimal places.');
    return { description, uom, ordered };
  });
  return { basis, lines };
}
