import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { PencilIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import apiClient from '../../services/api.service';
import UploadedPurchaseOrderPreview from './UploadedPurchaseOrderPreview';

const correctionError = problem => {
  const data = problem.response?.data;
  const message = data?.po_number || data?.detail || data?.error || data?.expected_updated_at || data?.non_field_errors;
  return (Array.isArray(message) ? message.join(' ') : message) || 'The PO number could not be saved. Try again.';
};

export default function PurchaseOrderNumberEditor({ order, onSaved, standalone = false, onCancel }) {
  const [editing, setEditing] = useState(standalone);
  const [number, setNumber] = useState(standalone ? order.po_number || '' : '');
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(standalone ? order.updated_at || '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(false);
  const editButton = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const close = () => {
    if (standalone) {
      onCancel?.();
      return;
    }
    setEditing(false);
    setError('');
    window.setTimeout(() => editButton.current?.focus(), 0);
  };

  const save = async event => {
    event.preventDefault();
    if (pending.current) return;
    if (!number.trim()) {
      setError('Enter a PO number.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const { data } = await apiClient.post(`/procurement/orders/${order.id}/correct-number/`, {
        po_number: number.trim(), expected_updated_at: expectedUpdatedAt,
      }, { suppressErrorToast: true });
      if (!mounted.current) return;
      if (String(data?.id) !== String(order.id)
          || data.po_number !== number.trim().replace(/\s/g, '').toUpperCase()) {
        setError('The saved PO number could not be confirmed. Refresh and check it.');
        return;
      }
      onSaved(data);
      if (standalone) {
        setNumber(data.po_number);
        setExpectedUpdatedAt(data.updated_at || '');
      } else close();
      toast.success('PO number saved.');
    } catch (problem) {
      if (mounted.current) setError(correctionError(problem));
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  if (!editing) return (
    <button
      ref={editButton}
      type="button"
      aria-label="Edit PO number"
      title="Edit PO number"
      onClick={() => {
        setNumber(order.po_number || '');
        setExpectedUpdatedAt(order.updated_at || '');
        setError('');
        setEditing(true);
      }}
      className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <PencilIcon className="h-4 w-4" />
    </button>
  );

  return (
    <form onSubmit={save} aria-label="Edit PO number" className="flex w-full flex-wrap items-center gap-2">
      <label className="min-w-0 flex-1 sm:flex-none">
        <span className={standalone ? 'mb-1 block text-sm font-medium text-slate-700' : 'sr-only'}>PO number</span>
        <input
          autoFocus
          value={number}
          maxLength={50}
          disabled={saving}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'po-number-correction-error' : undefined}
          onChange={event => { setNumber(event.target.value); setError(''); }}
          onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.preventDefault(); close(); } }}
          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50 sm:w-80"
        />
      </label>
      <button type="submit" disabled={saving} className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" disabled={saving} onClick={close} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50">
        Cancel
      </button>
      {error && <p id="po-number-correction-error" role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}

PurchaseOrderNumberEditor.propTypes = {
  order: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    po_number: PropTypes.string,
    updated_at: PropTypes.string,
  }).isRequired,
  onSaved: PropTypes.func.isRequired,
  standalone: PropTypes.bool,
  onCancel: PropTypes.func,
};

export function PurchaseOrderNumberCorrection({ order, onSaved, onClose }) {
  return (
    <section aria-label="Purchase order editor" className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Edit PO number</h1>
        <PurchaseOrderNumberEditor key={order.id} order={order} onSaved={onSaved} standalone onCancel={onClose} />
      </div>
      <section aria-label="Original purchase order" className="flex min-h-80 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 className="shrink-0 border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-900">Original source</h2>
        <UploadedPurchaseOrderPreview orderId={order.id} />
      </section>
    </section>
  );
}

PurchaseOrderNumberCorrection.propTypes = {
  order: PurchaseOrderNumberEditor.propTypes.order,
  onSaved: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
