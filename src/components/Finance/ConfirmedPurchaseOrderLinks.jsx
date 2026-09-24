import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

export default function ConfirmedPurchaseOrderLinks({ invoice, fallback = '—' }) {
  const references = Array.isArray(invoice?.confirmed_po_references)
    ? invoice.confirmed_po_references.filter(order => typeof order?.po_number === 'string' && order.po_number.trim()) : [];
  const unique = [...new Map(references.map(order => [order.id || order.po_number, order])).values()];
  if (!unique.length) return <span>{invoice?.po_reference_text || fallback}</span>;
  return <span>{unique.map((order, index) => <span key={order.id || order.po_number} className="inline-block">
    {index > 0 && ', '}{order.id ? <Link to={`/procurement/orders/${encodeURIComponent(order.id)}`} className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>{order.po_number}</Link> : order.po_number}
  </span>)}</span>;
}
ConfirmedPurchaseOrderLinks.propTypes = { invoice: PropTypes.object, fallback: PropTypes.string };
