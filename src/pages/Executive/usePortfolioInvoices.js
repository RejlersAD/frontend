import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/api.service';

export const PORTFOLIO_INVOICE_PAGE_SIZE = 10;

export default function usePortfolioInvoices(initial, filters) {
  const scope = JSON.stringify({ snapshot_id: initial?.source?.snapshot_id, ...filters });
  const [position, setPosition] = useState({ scope, initial, page: 0, financeSnapshotId: undefined });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ scope: '', key: '', data: null, error: null, loading: true });
  const positionMatches = position.scope === scope && position.initial === initial;
  const page = positionMatches ? position.page : 0;
  const financeSnapshotId = positionMatches ? position.financeSnapshotId : undefined;
  const enabled = initial?.enabled && ['available', 'partial'].includes(initial.status) && initial.source?.snapshot_id != null;
  const pageSnapshotId = page > 0 ? financeSnapshotId : undefined;
  const params = useMemo(() => ({ snapshot_id: initial?.source?.snapshot_id, ...filters, ...(pageSnapshotId != null ? { finance_snapshot_id: pageSnapshotId } : {}), limit: PORTFOLIO_INVOICE_PAGE_SIZE, offset: page * PORTFOLIO_INVOICE_PAGE_SIZE }), [initial?.source?.snapshot_id, filters, page, pageSnapshotId]);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState(current => ({ scope, key, data: current.scope === scope ? current.data : null, error: null, loading: true }));
    apiClient.get('/dashboard/executive/portfolio-workbook/outgoing-invoices/', { params, signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      const mismatch = (data?.source_snapshot_id != null && String(data.source_snapshot_id) !== String(params.snapshot_id))
        || (params.finance_snapshot_id != null && String(data?.finance_snapshot_id) !== String(params.finance_snapshot_id));
      if (mismatch) setState({ scope, key, data: null, error: { status: 409, message: 'A reporting source changed. Refresh the portfolio to reload connected invoices.' }, loading: false });
      else {
        if (page === 0 && data?.finance_snapshot_id != null) setPosition({ scope, initial, page: 0, financeSnapshotId: data.finance_snapshot_id });
        setState(data?.status === 'error' ? { scope, key, data: null, error: { status: 503, message: 'Recorded outgoing invoices could not be loaded.' }, loading: false } : { scope, key, data, error: null, loading: false });
      }
    }).catch(problem => {
      if (controller.signal.aborted) return;
      const status = problem.response?.status;
      const error = { status, message: status === 409 ? 'A reporting source changed. Refresh the portfolio to reload connected invoices.' : status === 403 ? 'Outgoing invoice access is restricted.' : 'Recorded outgoing invoices could not be loaded.' };
      setState({ scope, key, data: null, error, loading: false });
    });
    return () => controller.abort();
  }, [enabled, initial, key, params, revision, scope, page]);
  const matching = state.scope === scope;
  return {
    data: enabled && matching ? state.data : null,
    error: enabled && matching ? state.error : null,
    loading: Boolean(enabled && (!matching || state.key !== key || state.loading)),
    page, pageSize: PORTFOLIO_INVOICE_PAGE_SIZE,
    setPage: next => setPosition({ scope, initial, page: next, financeSnapshotId }),
    retry: () => setRevision(value => value + 1),
  };
}
