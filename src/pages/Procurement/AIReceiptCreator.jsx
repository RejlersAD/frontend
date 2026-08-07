import React, { useEffect, useMemo, useState } from 'react';
import {
  ArchiveBoxArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';


const RECEIVABLE_STATUSES = new Set(['sent', 'acknowledged', 'in_progress', 'partially_received']);

const apiErrorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data?.detail) return data.detail;
  if (data?.error) return data.error;
  if (data && typeof data === 'object') {
    const first = Object.entries(data)[0];
    if (first) return `${first[0].replaceAll('_', ' ')}: ${Array.isArray(first[1]) ? first[1].join(' ') : first[1]}`;
  }
  return error.message || 'Unable to record the goods receipt.';
};

const AIReceiptCreator = ({ isOpen, onClose, onReceiptCreated, orders = [], initialOrderId = null }) => {
  const eligibleOrders = useMemo(
    () => orders.filter((order) => RECEIVABLE_STATUSES.has(order.status)),
    [orders]
  );
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [summary, setSummary] = useState(null);
  const [lineValues, setLineValues] = useState({});
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    delivery_note_number: '',
    inspector_name: '',
    inspection_agency: '',
    inspection_report_number: '',
    notes: '',
    certificates_received: [],
  });

  useEffect(() => {
    if (!isOpen) return;
    const preferred = initialOrderId || (eligibleOrders.length === 1 ? eligibleOrders[0].id : '');
    setPurchaseOrderId(preferred ? String(preferred) : '');
    setSummary(null);
    setLineValues({});
    setError('');
  }, [isOpen, initialOrderId, eligibleOrders]);

  useEffect(() => {
    if (!isOpen || !purchaseOrderId) return;
    let active = true;
    const fetchSummary = async () => {
      setLoadingSummary(true);
      setError('');
      try {
        const response = await apiClient.get(`/procurement/orders/${purchaseOrderId}/receiving-summary/`);
        if (!active) return;
        setSummary(response.data);
        setLineValues(Object.fromEntries(
          (response.data.lines || []).map((line) => [line.id, {
            delivered: '',
            rejected: '0',
            rejection_reason: '',
            batch_number: '',
            heat_number: '',
          }])
        ));
      } catch (requestError) {
        if (active) setError(apiErrorMessage(requestError));
      } finally {
        if (active) setLoadingSummary(false);
      }
    };
    fetchSummary();
    return () => { active = false; };
  }, [isOpen, purchaseOrderId]);

  if (!isOpen) return null;

  const updateLine = (lineId, field, value) => {
    setLineValues((previous) => ({
      ...previous,
      [lineId]: { ...previous[lineId], [field]: value },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    let lines;
    try {
      lines = (summary?.lines || []).flatMap((line) => {
        const values = lineValues[line.id] || {};
        const delivered = Number(values.delivered || 0);
        const rejected = Number(values.rejected || 0);
        if (delivered <= 0) return [];
        if (delivered > Number(line.remaining_quantity)) {
          throw new Error(`Line ${line.line_number} exceeds the remaining quantity.`);
        }
        if (rejected < 0 || rejected > delivered) {
          throw new Error(`Line ${line.line_number} has an invalid rejected quantity.`);
        }
        if (rejected > 0 && !String(values.rejection_reason || '').trim()) {
          throw new Error(`Line ${line.line_number} requires a rejection reason.`);
        }
        return [{
          purchase_order_line: line.id,
          delivered_quantity: delivered,
          accepted_quantity: delivered - rejected,
          rejected_quantity: rejected,
          rejection_reason: values.rejection_reason || '',
          batch_number: values.batch_number || '',
          heat_number: values.heat_number || '',
        }];
      });
    } catch (validationError) {
      setError(validationError.message);
      return;
    }
    if (!lines.length) {
      setError('Enter a delivered quantity for at least one PO line.');
      return;
    }

    setSubmitting(true);
    try {
      let response = await apiClient.post('/procurement/receipts/', {
        purchase_order: purchaseOrderId,
        lines,
        ...formData,
      });
      response = await apiClient.post(`/procurement/receipts/${response.data.id}/submit/`);
      onReceiptCreated?.(response.data);
      onClose?.();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <ArchiveBoxArrowDownIcon className="h-7 w-7" />
            <div>
              <h2 className="text-xl font-bold">Record Goods Receipt</h2>
              <p className="text-sm text-indigo-100">PO-linked quantity receipt and quality disposition</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Purchase Order</label>
            <select
              required
              value={purchaseOrderId}
              onChange={(event) => setPurchaseOrderId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Select a receivable purchase order</option>
              {eligibleOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.po_number} — {order.vendor_name || order.title}
                </option>
              ))}
            </select>
          </div>

          {loadingSummary && <p className="py-8 text-center text-sm text-gray-500">Loading PO quantities…</p>}

          {summary && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">PO</p><p className="font-semibold">{summary.po_number}</p></div>
                <div className="rounded-lg bg-blue-50 p-3"><p className="text-xs text-blue-600">Ordered</p><p className="font-semibold text-blue-900">{summary.ordered_quantity}</p></div>
                <div className="rounded-lg bg-green-50 p-3"><p className="text-xs text-green-600">Accepted</p><p className="font-semibold text-green-900">{summary.accepted_quantity}</p></div>
                <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-600">Remaining</p><p className="font-semibold text-amber-900">{summary.remaining_quantity}</p></div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                    <tr>
                      <th className="px-3 py-3">Line / Description</th>
                      <th className="px-3 py-3 text-right">Ordered</th>
                      <th className="px-3 py-3 text-right">Previously accepted</th>
                      <th className="px-3 py-3 text-right">Remaining</th>
                      <th className="px-3 py-3">Delivered now</th>
                      <th className="px-3 py-3">Rejected</th>
                      <th className="px-3 py-3">Batch / Heat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.lines.map((line) => {
                      const values = lineValues[line.id] || {};
                      return (
                        <tr key={line.id}>
                          <td className="px-3 py-3"><p className="font-semibold">{line.line_number}. {line.description}</p><p className="text-xs text-gray-500">{line.unit_of_measure}</p></td>
                          <td className="px-3 py-3 text-right">{line.ordered_quantity}</td>
                          <td className="px-3 py-3 text-right">{line.accepted_quantity}</td>
                          <td className="px-3 py-3 text-right font-semibold">{line.remaining_quantity}</td>
                          <td className="px-3 py-3"><input type="number" min="0" max={line.remaining_quantity} step="0.0001" value={values.delivered || ''} onChange={(e) => updateLine(line.id, 'delivered', e.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1.5" /></td>
                          <td className="px-3 py-3 space-y-1"><input type="number" min="0" max={values.delivered || 0} step="0.0001" value={values.rejected || '0'} onChange={(e) => updateLine(line.id, 'rejected', e.target.value)} className="w-24 rounded border border-gray-300 px-2 py-1.5" />{Number(values.rejected || 0) > 0 && <input value={values.rejection_reason || ''} onChange={(e) => updateLine(line.id, 'rejection_reason', e.target.value)} placeholder="Reason" className="w-40 rounded border border-red-300 px-2 py-1.5" />}</td>
                          <td className="px-3 py-3 space-y-1"><input value={values.batch_number || ''} onChange={(e) => updateLine(line.id, 'batch_number', e.target.value)} placeholder="Batch" className="w-28 rounded border border-gray-300 px-2 py-1.5" /><input value={values.heat_number || ''} onChange={(e) => updateLine(line.id, 'heat_number', e.target.value)} placeholder="Heat" className="w-28 rounded border border-gray-300 px-2 py-1.5" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">Delivery Note Number<input required value={formData.delivery_note_number} onChange={(e) => setFormData((p) => ({ ...p, delivery_note_number: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
                <label className="text-sm font-medium text-gray-700">Inspector Name<input value={formData.inspector_name} onChange={(e) => setFormData((p) => ({ ...p, inspector_name: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
                <label className="text-sm font-medium text-gray-700">Inspection Agency<input value={formData.inspection_agency} onChange={(e) => setFormData((p) => ({ ...p, inspection_agency: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
                <label className="text-sm font-medium text-gray-700">Inspection Report Number<input value={formData.inspection_report_number} onChange={(e) => setFormData((p) => ({ ...p, inspection_report_number: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
              </div>
              <label className="block text-sm font-medium text-gray-700">Notes<textarea rows={3} value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={submitting || loadingSummary || !summary?.can_receive} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <SparklesIcon className="h-5 w-5 animate-pulse" /> : <CheckCircleIcon className="h-5 w-5" />}
              {submitting ? 'Recording…' : 'Create and Submit GR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIReceiptCreator;
