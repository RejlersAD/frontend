/** Public reporting provenance; never interpret retrieval time as source freshness. */
export function financeSource(data) {
  const source = data?.sources?.receivables || data?.source || {};
  const workbook = source.mode === 'workbook' || source.kind === 'finance_source_snapshot';
  return {
    workbook,
    label: workbook ? 'Published Finance workbook' : source.label || 'Current authorised invoice register',
    timestampLabel: workbook ? 'Finance snapshot published' : 'Latest Finance record',
    timestamp: workbook ? source.published_at || source.imported_at || source.source_updated_at || data?.workbook_summary?.source?.snapshot_at || data?.source_updated_at : data?.source_updated_at || source.source_updated_at,
    route: workbook ? '/finance' : '/finance/outgoing-invoices',
  };
}

export function overviewExport(report, snapshot, currency) {
  const finance = snapshot?.receivables?.currency === currency && !snapshot.loading && !snapshot.error ? snapshot : null;
  return {
    ...report,
    report_type: 'executive_overview',
    finance: finance ? {
      receivables: finance.receivables,
      reporting_period: finance.reporting_period,
      source_description: finance.source_description,
    } : null,
    finance_status: finance ? 'loaded' : snapshot?.loading ? 'loading' : 'unavailable',
    reporting_currency: currency,
  };
}
