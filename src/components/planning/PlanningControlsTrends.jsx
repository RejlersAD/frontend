import { useState } from 'react'
import PropTypes from 'prop-types'
import { controlsList as list, controlsNumber as numeric, controlsValue as value, controlsLabel as label } from './planningControlsPresentation'

const timestamp = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? Date.parse(`${date}T00:00:00Z`) : NaN
const progressSeries = [{ field: 'progress_pct', label: 'Earned progress', color: '#087658' }]
const costSeries = [{ field: 'pv', label: 'Planned value', color: '#0751ff' }, { field: 'ev', label: 'Earned value', color: '#087658' }, { field: 'ac', label: 'Actual cost', color: '#9c5a08' }]

function PublishedCurve({ rows, monetary }) {
  const series = monetary ? costSeries : progressSeries
  const dated = rows.filter(row => Number.isFinite(timestamp(row.date)))
  const values = dated.flatMap(row => series.map(item => numeric(row[item.field]))).filter(item => item !== null)
  if (!dated.length || !values.length) return <p>No published values are available for this curve.</p>
  const minDate = Math.min(...dated.map(row => timestamp(row.date))), maxDate = Math.max(...dated.map(row => timestamp(row.date)))
  const lower = Math.min(0, ...values), upper = Math.max(...values), range = upper - lower || 1
  const x = row => 62 + (timestamp(row.date) - minDate) / (maxDate - minDate || 1) * 804
  const y = amount => 232 - (amount - lower) / range * 204
  const segments = field => {
    const output = []; let previous = null, segment = []
    dated.forEach((row, index) => {
      const amount = numeric(row[field]), group = `${row.policy_id ?? `unrecorded-${index}`}:${row.currency ?? 'unknown'}`
      if (amount === null || (previous !== null && previous !== group)) { if (segment.length) output.push(segment); segment = [] }
      if (amount !== null) segment.push({ row, x: x(row), y: y(amount) })
      previous = group
    }); if (segment.length) output.push(segment)
    return output
  }
  return <><div className="poc-legend">{series.map(item => <span key={item.field}><i style={{ background: item.color }} />{item.label}</span>)}</div><svg className="poc-curve" role="img" aria-label={`Published ${monetary ? 'planned value, earned value and actual cost' : 'earned progress'} by reporting data date. Missing values and changed earning policies are not connected.`} viewBox="0 0 900 270">
    {[0, .25, .5, .75, 1].map(mark => { const amount = lower + mark * range; return <g key={mark}><line x1="62" x2="866" y1={y(amount)} y2={y(amount)} stroke="#dce6f3" /><text x="53" y={y(amount) + 4} textAnchor="end">{value(amount, monetary ? '' : '%')}</text></g> })}
    {series.flatMap(item => segments(item.field).map((segment, index) => <g key={`${item.field}-${index}`} data-series={item.field}><polyline points={segment.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2" />{segment.map((point, at) => <circle key={at} cx={point.x} cy={point.y} r="3" fill={item.color}><title>{point.row.date}: {value(point.row[item.field], monetary ? ` ${point.row.currency || ''}` : '%')}</title></circle>)}</g>))}
    <text x="62" y="258">{dated[0].date}</text><text x="866" y="258" textAnchor="end">{dated.at(-1).date}</text>
  </svg></>
}
PublishedCurve.propTypes = { rows: PropTypes.array.isRequired, monetary: PropTypes.bool }

export default function PlanningControlsTrends({ data }) {
  const [mode, setMode] = useState('chart'), [measure, setMeasure] = useState('progress'), [currency, setCurrency] = useState('')
  const canCosts = data.permissions?.can_view_costs === true, curves = list(data.curves), currencies = [...new Set(curves.map(row => row.currency).filter(Boolean))]
  const monetary = canCosts && measure === 'cost', selectedCurrency = currency || (currencies.length === 1 ? currencies[0] : '')
  const rows = curves.filter(row => !monetary || (selectedCurrency && row.currency === selectedCurrency)).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const chartRows = curves.map(row => monetary && (!selectedCurrency || row.currency !== selectedCurrency) ? { ...row, pv: null, ev: null, ac: null } : row).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const preview = data.report?.preview || {}, forecast = preview.forecast || {}, comparisons = list(preview.activity_comparisons)
  return <section className="poc-section" aria-label="Operational reporting trends"><header><div><h3>Published trends and remaining-work forecast</h3><p>Curves use published reporting periods. The selected report preview and its forecast are shown separately.</p></div></header>
    <div className="poc-toolbar"><label>Curve measure<select aria-label="Reporting curve measure" value={measure} onChange={event => setMeasure(event.target.value)}><option value="progress">Earned progress</option>{canCosts && <option value="cost">Planned / earned / actual value</option>}</select></label>{monetary && <label>Currency<select aria-label="Reporting curve currency" value={selectedCurrency} onChange={event => setCurrency(event.target.value)}><option value="">Select currency</option>{currencies.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}<div className="poc-actions"><button type="button" aria-pressed={mode === 'chart'} onClick={() => setMode('chart')}>Chart</button><button type="button" aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Data table</button></div></div>
    {mode === 'chart' ? <PublishedCurve rows={chartRows} monetary={monetary} /> : <div className="poc-table" tabIndex={0} role="region" aria-label="Published reporting values"><table><thead><tr><th>Data date</th><th>Report / revision</th><th>Earning policy</th><th>Earned progress</th>{canCosts && <><th>Currency</th><th>Planned value</th><th>Earned value</th><th>Actual cost</th></>}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.report_id}-${index}`}><td>{row.date}</td><td>{row.report_id} / {row.revision}</td><td>{label(row.policy_id)}</td><td>{value(row.progress_pct, '%')}</td>{canCosts && <><td>{label(row.currency)}</td><td>{value(row.pv)}</td><td>{value(row.ev)}</td><td>{value(row.ac)}</td></>}</tr>)}{!rows.length && <tr><td colSpan={canCosts ? 8 : 4}>No published observations match this selection.</td></tr>}</tbody></table></div>}
    <p className="poc-note">Missing observations and changes of earning policy or currency break the line. Published history is preserved.</p>
    <section aria-label="Remaining-work forecast"><h3>Remaining-work forecast</h3><p>Status: <strong>{label(forecast.status)}</strong> · Method: {label(forecast.method)} · Data date: {label(forecast.data_date)}{forecast.data_date_convention && ` (${label(forecast.data_date_convention)})`}</p><dl className="poc-metrics"><div><dt>Contractual finish</dt><dd>{label(forecast.contractual_finish)}</dd></div><div><dt>Forecast finish</dt><dd>{label(forecast.forecast_finish)}</dd></div><div><dt>Finish variance</dt><dd>{value(forecast.finish_variance_calendar_days, ' calendar days')}</dd></div></dl><p>Positive variance means later than baseline. Forecasts do not change contractual dates.</p>{list(forecast.limitations).length > 0 && <details><summary>Forecast calculation limits</summary><ul>{forecast.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
      <div className="poc-table" tabIndex={0} role="region" aria-label="Remaining-work activity forecast"><table><thead><tr>{['Activity', 'Actual start', 'Actual finish', 'Remaining start', 'Remaining finish', 'Forecast start', 'Forecast finish', 'Total float', 'Status'].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{list(forecast.activities).map(row => <tr key={row.activity_id}><th scope="row">{list(data.activities).find(activity => String(activity.id) === String(row.activity_id))?.name || row.activity_id}</th><td>{label(row.actual_start)}</td><td>{label(row.actual_finish)}</td><td>{label(row.remaining_start)}</td><td>{label(row.remaining_finish)}</td><td>{label(row.forecast_start)}</td><td>{label(row.forecast_finish)}</td><td>{value(row.total_float_days, ' d')}</td><td>{label(row.status)}{list(row.unavailable_reasons).map((reason, index) => <small key={index}>{label(reason)}</small>)}</td></tr>)}{!list(forecast.activities).length && <tr><td colSpan={9}>A remaining-work forecast is not available for this report.</td></tr>}</tbody></table></div>
    </section>
    <section aria-label="Operational baseline comparison"><h3>Baseline comparison</h3><div className="poc-table" tabIndex={0} role="region" aria-label="Baseline and reported activity dates"><table><thead><tr>{['Activity', 'Baseline start', 'Baseline finish', 'Actual start', 'Actual finish', 'Forecast finish', 'Finish variance', 'Missing information'].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{comparisons.map((row, index) => <tr key={row.activity_id || index}><th scope="row">{list(data.activities).find(activity => String(activity.id) === String(row.activity_id))?.name || row.activity_id}</th><td>{label(row.baseline_start)}</td><td>{label(row.baseline_finish)}</td><td>{label(row.actual_start)}</td><td>{label(row.actual_finish)}</td><td>{label(row.forecast_finish)}</td><td>{value(row.finish_variance_calendar_days, ' calendar days')}</td><td>{list(row.unavailable_reasons).map(label).join(', ') || 'None reported'}</td></tr>)}{!comparisons.length && <tr><td colSpan={8}>No activity comparison is available for this report.</td></tr>}</tbody></table></div></section>
  </section>
}
PlanningControlsTrends.propTypes = { data: PropTypes.object.isRequired }
