import React from 'react';
import PropTypes from 'prop-types';
import { codelistOptions, resolveBuhasaAttribute } from '../../../../services/buhasaCodelists';

const categories = { PressureRating: 'Rating', EndPreparation: 'End', FlangeFacing: 'Facing', MaterialsGrade: 'Material', ScheduleThickness: 'Schedule', BoltType: 'Bolt' };
const legacy = { pressure: 'PressureRating', end_connection: 'EndPreparation', material: 'MaterialsGrade' };
const describe = (category, values, codes = []) => {
  const labels = codes.map(code => {
    const matches = codelistOptions(category).filter(entry => entry.code === code);
    return matches.length === 1 ? `${matches[0].shortDesc} (${code})` : `Code ${code}`;
  });
  return labels.length ? labels.join(' / ') : values?.join(' / ') || 'not supplied';
};

export default function S3DCandidateDiffs({ candidate, attributes = {} }) {
  const rows = [];
  for (const [key, detail] of Object.entries(candidate.discriminators || {})) {
    if (key === 'size') rows.push({ key, label: 'Size', actual: detail.values?.join(' / ') || 'not supplied', source: detail.requested || '', matched: detail.matched === true });
    else if (legacy[key] && !candidate.codelists?.[legacy[key]]) {
      const category = legacy[key];
      const source = attributes[category];
      rows.push({ key, label: categories[category], actual: detail.values?.join(' / ') || 'not supplied', source: source?.shortDesc ? `${source.shortDesc} (${source.code})` : source?.raw || detail.requested || 'not supplied', matched: detail.matched === true && !['AMBIGUOUS', 'UNMAPPED_CODELIST'].includes(source?.status) });
    }
  }
  for (const [category, detail] of Object.entries(candidate.codelists || {})) {
    const source = attributes[category];
    const expected = source?.candidates || (source?.raw ? resolveBuhasaAttribute(category, source.raw).candidates : []);
    const codes = detail.codes || [];
    const matched = source?.status === 'RESOLVED' && codes.length === 1 && expected.some(entry => codes.includes(entry.code));
    if (!detail.values?.length && !source?.raw) continue;
    rows.push({ key: category, label: categories[category] || category, actual: describe(category, detail.values, codes),
      source: source?.shortDesc ? `${source.shortDesc} (${source.code})` : source?.raw || 'not supplied', matched,
      ambiguous: source?.status === 'AMBIGUOUS', catalogAmbiguous: codes.length > 1 });
  }
  return <span className="s3d-candidate-diffs">{rows.map(row => <span key={row.key}>
    <span className={`s3d-diff-badge s3d-diff-badge--${row.matched ? 'match' : 'warning'}`}>{row.label}: {row.actual} {row.matched ? '✓' : '≠'}{!row.matched ? ` Source ${row.source}` : ''}</span>
    {!row.matched && <span className="s3d-diff-message">Verify {row.label.toLowerCase()} against source: catalog {row.actual}; source {row.source}{row.ambiguous ? ' (ambiguous)' : ''}.{row.catalogAmbiguous ? ' Catalog contains multiple codelist IDs.' : ''}</span>}
  </span>)}</span>;
}
S3DCandidateDiffs.propTypes = { candidate: PropTypes.object.isRequired, attributes: PropTypes.object };
