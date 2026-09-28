import { useState } from 'react';
import PropTypes from 'prop-types';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { buildReceivingBasis } from './receiptReceivingBasis';

const blankLine = () => ({ description: '', uom: '', ordered: '' });

export default function ReceiptReceivingBasisEditor({ currency, disabled, saving, onSave }) {
  const [basis, setBasis] = useState('');
  const [goods, setGoods] = useState([blankLine()]);
  const [serviceLine, setServiceLine] = useState({ ...blankLine(), uom: currency });
  const [error, setError] = useState('');
  const service = basis === 'service_value';
  const lines = service ? [serviceLine] : goods;
  const change = (index, key, value) => {
    if (service) setServiceLine(current => ({ ...current, [key]: value }));
    else setGoods(current => current.map((line, position) => position === index ? { ...line, [key]: value } : line));
    setError('');
  };
  const save = () => {
    try { const payload = buildReceivingBasis(basis, lines, currency); setError(''); onSave(payload); }
    catch (failure) { setError(failure.message); }
  };
  return <div className="receipt-basis" role="region" aria-label="Set receiving basis">
    <div className="receipt-basis__heading"><h3>Set receiving basis</h3><div className="receipt-delivery__segments" role="group" aria-label="Receiving basis">
      {[['quantity', 'Goods'], ['service_value', 'Services']].map(([value, label]) => <button key={value} type="button" disabled={disabled} aria-pressed={basis === value} onClick={() => { setBasis(value); setError(''); }}>{label}</button>)}
    </div></div>
    {basis && lines.map((line, index) => <div className="receipt-basis__line" key={index}>
      <label>{service ? 'Service scope' : `Item description ${index + 1}`}<input maxLength={2000} disabled={disabled} value={line.description} onChange={event => change(index, 'description', event.target.value)} /></label>
      <label>{service ? 'Currency' : `Unit ${index + 1}`}<input maxLength={30} disabled={disabled} value={line.uom} onChange={event => change(index, 'uom', event.target.value)} /></label>
      <label>{service ? 'Confirmed net value (excl. VAT)' : `Ordered quantity ${index + 1}`}<input type="number" min="0" step="any" disabled={disabled} value={line.ordered} onChange={event => change(index, 'ordered', event.target.value)} /></label>
      {!service && goods.length > 1 && <button type="button" className="receipt-entry__icon-button" aria-label={`Remove receiving line ${index + 1}`} disabled={disabled} onClick={() => setGoods(current => current.filter((_, position) => position !== index))}><TrashIcon /></button>}
    </div>)}
    {error && <p role="alert" className="receipt-entry__validation">{error}</p>}
    <div className="receipt-basis__actions">{basis === 'quantity' && <button type="button" className="receipt-entry__button" disabled={disabled || goods.length >= 100} onClick={() => setGoods(current => [...current, blankLine()])}><PlusIcon />Add line</button>}<button type="button" className="receipt-entry__button" disabled={disabled} onClick={save}>{saving ? 'Saving basis…' : 'Save receiving basis'}</button></div>
  </div>;
}

ReceiptReceivingBasisEditor.propTypes = { currency: PropTypes.string.isRequired, disabled: PropTypes.bool, saving: PropTypes.bool, onSave: PropTypes.func.isRequired };
