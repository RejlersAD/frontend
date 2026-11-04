import PropTypes from 'prop-types';

const labels = {
  customer_name: 'Customer', organization_name: 'Organization', project_name: 'Project',
  tender_reference: 'Tender reference', rfq_reference: 'RFQ reference', pr_reference: 'PR reference',
  opportunity_reference: 'Opportunity reference', scope_summary: 'Scope', scope_type: 'Scope type',
  estimated_value: 'Estimated value', currency: 'Currency', due_date: 'Deadline',
  expected_award_date: 'Expected award date',
};

export default function SalesUnifiedEvidenceView({ evidence, title = 'Unified evidence' }) {
  const selected = evidence?.selected && typeof evidence.selected === 'object' ? evidence.selected : {};
  const rows = Object.entries(selected).filter(([, item]) => item && typeof item === 'object');
  if (!rows.length) return null;
  return <section aria-label={title} className="mt-4 min-w-0">
    <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
    <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-600"><tr>
          <th className="px-3 py-2 font-semibold">Field</th><th className="px-3 py-2 font-semibold">Selected value</th>
          <th className="px-3 py-2 font-semibold">Confidence</th><th className="px-3 py-2 font-semibold">Source</th>
          <th className="px-3 py-2 font-semibold">Status</th>
        </tr></thead>
        <tbody>{rows.map(([field, item]) => <tr key={field} className="border-t border-slate-100 align-top">
          <th scope="row" className="px-3 py-2 font-medium text-slate-700">{labels[field] || field.replaceAll('_', ' ')}</th>
          <td className="px-3 py-2 text-slate-900">{item.value || 'Needs review'}{item.reason && <p className="mt-1 whitespace-normal text-slate-500">{item.reason}</p>}</td>
          <td className="px-3 py-2 text-slate-700">{Number.isFinite(item.confidence) ? `${item.confidence}%` : '—'}</td>
          <td className="px-3 py-2 text-slate-700">{(item.sources || []).map(source => <div key={`${source.source_id}:${source.source_location}`}>
            <span className="font-medium">{source.source_name}</span><br />{source.source_location}
          </div>)}</td>
          <td className="px-3 py-2 text-slate-700">{item.status?.replaceAll('_', ' ') || 'unresolved'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

SalesUnifiedEvidenceView.propTypes = { evidence: PropTypes.object, title: PropTypes.string };
