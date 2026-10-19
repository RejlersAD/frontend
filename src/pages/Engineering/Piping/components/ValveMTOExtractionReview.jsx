import React from 'react';
import PropTypes from 'prop-types';

const messagesProp = PropTypes.arrayOf(PropTypes.string).isRequired;

export default function ValveMTOExtractionReview({ review, onOpenLegends, onOpenValidation }) {
  return (
    <section aria-labelledby="extraction-review-title" className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Engineering assurance</p>
          <h2 id="extraction-review-title" className="text-xl font-bold text-slate-900 mt-1">Extraction Review</h2>
          <p className="text-sm text-slate-500 mt-2">
            Field completeness and source-evidence findings. Populated values are not automatically verified.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenLegends} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Manage source legends
          </button>
          <button onClick={onOpenValidation} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">
            Inspect affected rows
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Review candidates', review.total],
          ['Rows with field gaps', review.rowsWithGaps],
          ['Low / missing confidence', review.lowConfidence],
          ['Finding categories', review.groups.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Review draft, not approved for procurement. Missing source evidence remains blank.
        A generic legend cannot supply project-specific materials, ratings, or installation areas.
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-800">Required record coverage</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr>{['Record', 'Populated', 'Missing', 'Coverage', 'Required evidence / next action'].map(label =>
                <th key={label} className="text-left px-4 py-3 font-semibold" scope="col">{label}</th>)}</tr>
            </thead>
            <tbody>
              {review.coverage.map(field => (
                <tr key={field.key} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="text-left px-4 py-3 font-semibold text-slate-700">{field.label}</th>
                  <td className="px-4 py-3">{field.populated} / {review.total}</td>
                  <td className={`px-4 py-3 font-semibold ${field.missing ? 'text-amber-700' : 'text-teal-700'}`}>{field.missing}</td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-24 rounded-full bg-slate-100" aria-hidden="true">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${field.percent}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{field.percent}% populated</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-sm">{field.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Prioritized review findings</h3>
        {!review.groups.length && <p className="text-sm text-slate-500">No extraction findings recorded. Field gaps above still require evidence review.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          {review.groups.map(group => (
            <article key={group.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-center gap-3">
                <h4 className="text-sm font-bold text-slate-800">{group.title}</h4>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{group.messages.length} findings</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">{group.action}</p>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-semibold text-teal-700">Show source findings</summary>
                <ul className="list-disc pl-4 mt-2 space-y-2 text-slate-600">{group.messages.map(message => <li key={message}>{message}</li>)}</ul>
              </details>
            </article>
          ))}
        </div>
      </div>
      {[
        ['Extraction method and reference evidence', review.information],
        ['Non-valve items excluded from counting', review.excluded],
        ['Complete extraction audit messages', review.messages],
      ].map(([title, messages]) => (
        <details key={title} className="rounded-xl border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">{title} ({messages.length})</summary>
          <ul className="list-disc pl-5 mt-3 text-xs text-slate-500 space-y-2">{messages.map(message => <li key={message}>{message}</li>)}</ul>
        </details>
      ))}
    </section>
  );
}

ValveMTOExtractionReview.propTypes = {
  review: PropTypes.shape({
    total: PropTypes.number.isRequired,
    rowsWithGaps: PropTypes.number.isRequired,
    lowConfidence: PropTypes.number.isRequired,
    coverage: PropTypes.arrayOf(PropTypes.object).isRequired,
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
    excluded: messagesProp,
    information: messagesProp,
    messages: messagesProp,
  }).isRequired,
  onOpenLegends: PropTypes.func.isRequired,
  onOpenValidation: PropTypes.func.isRequired,
};

