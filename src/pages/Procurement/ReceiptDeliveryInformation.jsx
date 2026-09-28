import PropTypes from 'prop-types';
import { CalendarDaysIcon, ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export default function ReceiptDeliveryInformation({ form, basis, actor, deliveryStatus, onChange, onStatusChange, disabled }) {
  const identity = actor.data?.user || actor.data;
  const recorder = [identity?.first_name, identity?.last_name].filter(Boolean).join(' ').trim() || identity?.email || identity?.username || '';
  const location = typeof actor.data?.location === 'string' ? actor.data.location.trim() : '';
  const exception = ['partial', 'rejected'].includes(deliveryStatus);
  return <section className="receipt-entry__panel receipt-delivery" aria-labelledby="receipt-delivery-title">
    <h2 id="receipt-delivery-title">Delivery information</h2>
    <div className="receipt-delivery__fields">
      <div className="receipt-delivery__field"><span id="receipt-type-label">Receipt Type <b aria-hidden="true">*</b></span>
        <div className="receipt-delivery__segments receipt-delivery__type" role="group" aria-labelledby="receipt-type-label">
          {[['quantity', 'Goods'], ['service_value', 'Services']].map(([value, label]) => <button type="button" key={value} aria-pressed={basis === value} disabled>{label}</button>)}
        </div>
      </div>
      <label className="receipt-delivery__field">Delivery Date <b aria-hidden="true">*</b><span className="receipt-delivery__date"><CalendarDaysIcon aria-hidden="true" /><input type="date" required value={form.receipt_date} onChange={event => onChange('receipt_date', event.target.value)} /></span></label>
      <label className="receipt-delivery__field">Received By <b aria-hidden="true">*</b><select value={recorder} disabled><option value={recorder}>{recorder || (actor.loading ? 'Loading recorder…' : 'Recorder name unavailable')}</option></select></label>
      <label className="receipt-delivery__field">Delivery Location <b aria-hidden="true">*</b><span className="receipt-delivery__location"><input list="receipt-delivery-locations" required maxLength={300} placeholder="Enter delivery location" value={form.delivery_location} onChange={event => onChange('delivery_location', event.target.value)} /><ChevronDownIcon aria-hidden="true" /></span><datalist id="receipt-delivery-locations">{location && <option value={location} />}</datalist></label>
      <label className="receipt-delivery__field">Delivery Note No.<input maxLength={100} placeholder="Enter delivery note number" value={form.delivery_note_number} onChange={event => onChange('delivery_note_number', event.target.value)} /></label>
      <label className="receipt-delivery__field">Supplier Reference<input maxLength={100} placeholder="Enter supplier reference" value={form.supplier_reference} onChange={event => onChange('supplier_reference', event.target.value)} /></label>
      <label className="receipt-delivery__field">Condition <b aria-hidden="true">*</b><select required value={form.condition} onChange={event => onChange('condition', event.target.value)}><option value="">Select condition</option><option value="good">Accepted with no damage</option><option value="damaged">Damage observed</option><option value="not_inspected">Not inspected</option></select></label>
      <div className="receipt-delivery__field"><span id="receipt-delivery-status-label">Delivery Status <b aria-hidden="true">*</b></span><div className="receipt-delivery__segments" role="group" aria-labelledby="receipt-delivery-status-label">
        {[['full', 'Full'], ['partial', 'Partial'], ['rejected', 'Rejected']].map(([value, label]) => <button key={value} type="button" aria-pressed={deliveryStatus === value} disabled={disabled} onClick={() => onStatusChange(value)}>{label}</button>)}
      </div><p className="receipt-delivery__hint"><InformationCircleIcon aria-hidden="true" />Partial or rejected receipts require an exception reason.</p></div>
      {exception && <label className="receipt-delivery__field receipt-delivery__exception">Exception reason <b aria-hidden="true">*</b><textarea required maxLength={4000} rows={2} placeholder="Explain the partial or rejected delivery" value={form.exception_reason} onChange={event => onChange('exception_reason', event.target.value)} /></label>}
    </div>
  </section>;
}

ReceiptDeliveryInformation.propTypes = {
  form: PropTypes.object.isRequired, basis: PropTypes.string, actor: PropTypes.object.isRequired,
  deliveryStatus: PropTypes.string, onChange: PropTypes.func.isRequired, onStatusChange: PropTypes.func.isRequired, disabled: PropTypes.bool,
};
