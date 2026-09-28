import PropTypes from 'prop-types';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const blankLine = () => ({ description: '', uom: '', ordered: '' });

export default function ReceiptReceivingBasisEditor({ basis, lines, disabled, saving, onChange, onSave }) {
  const service = basis === 'service_value';
  const change = (index, key, value) => {
    onChange(lines.map((line, position) => position === index ? { ...line, [key]: value } : line));
  };
  return <div className="receipt-basis" role="region" aria-label="Set receiving basis">
    <div className="receipt-basis__heading"><h3>Set receiving basis</h3></div>
    {basis && lines.map((line, index) => <div className="receipt-basis__line" key={index}>
      <label>{service ? 'Service scope' : `Item description ${index + 1}`}<input required maxLength={2000} disabled={disabled} value={line.description} onChange={event => change(index, 'description', event.target.value)} /></label>
      <label>{service ? 'Currency' : `Unit ${index + 1}`}<input required maxLength={30} disabled={disabled} value={line.uom} onChange={event => change(index, 'uom', event.target.value)} /></label>
      <label>{service ? 'Confirmed net value (excl. VAT)' : `Ordered quantity ${index + 1}`}<input required type="number" min="0" step="any" disabled={disabled} value={line.ordered} onChange={event => change(index, 'ordered', event.target.value)} /></label>
      {!service && lines.length > 1 && <button type="button" className="receipt-entry__icon-button" aria-label={`Remove receiving line ${index + 1}`} disabled={disabled} onClick={() => onChange(lines.filter((_, position) => position !== index))}><TrashIcon /></button>}
    </div>)}
    <div className="receipt-basis__actions">{basis === 'quantity' && <button type="button" className="receipt-entry__button" disabled={disabled || lines.length >= 100} onClick={() => onChange([...lines, blankLine()])}><PlusIcon />Add line</button>}<button type="button" className="receipt-entry__button" disabled={disabled} onClick={onSave}>{saving ? 'Saving basis…' : 'Save receiving basis'}</button></div>
  </div>;
}

ReceiptReceivingBasisEditor.propTypes = { basis: PropTypes.string.isRequired, lines: PropTypes.array.isRequired, disabled: PropTypes.bool, saving: PropTypes.bool, onChange: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired };
