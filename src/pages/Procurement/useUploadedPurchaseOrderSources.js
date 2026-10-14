import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/api.service';

// Source discovery must finish before callers decide to generate a replacement.
// Scope state to the order so changing selection never exposes the previous PDF.
export function useUploadedPurchaseOrderSources(orderId, active = true) {
  const orderKey = orderId == null ? '' : String(orderId);
  const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState({ orderKey, active, attempt });
  const [listing, setListing] = useState({ request: null, documents: [], loading: false, error: '' });
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  // Reset the request identity during render: neither a retry nor reopening the
  // same order may briefly expose an old empty result to a generation effect.
  if (request.orderKey !== orderKey || request.active !== active || request.attempt !== attempt) {
    setRequest({ orderKey, active, attempt });
  }

  useEffect(() => {
    if (!request.active || !request.orderKey) return undefined;
    const controller = new AbortController();
    setListing({ request, documents: [], loading: true, error: '' });
    apiClient.get(`/procurement/orders/${request.orderKey}/uploaded-documents/`, {
      signal: controller.signal, timeout: 30000, suppressErrorToast: true,
    }).then(response => {
      const rows = Array.isArray(response.data) ? response.data : response.data?.results;
      if (!Array.isArray(rows)) throw new Error('Invalid document list');
      if (!controller.signal.aborted) setListing({ request, documents: rows, loading: false, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted) setListing({ request, documents: [], loading: false, error: 'Uploaded PO documents could not be loaded.' });
    });
    return () => controller.abort();
  }, [request]);

  const current = listing.request === request;
  return {
    documents: current ? listing.documents : [],
    loading: Boolean(active && orderKey && (!current || listing.loading)),
    error: current ? listing.error : '',
    retry,
  };
}

export default useUploadedPurchaseOrderSources;
