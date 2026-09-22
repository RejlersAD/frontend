import PropTypes from 'prop-types'

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const emptyProfileCalendar = () => ({ working_weekdays: [], hours_per_day: '', timezone: '', exceptions: [], working_times: {} })
const fullTime = value => value && value.length === 5 ? `${value}:00` : value

function WorkingTimes({ value = [], onChange, name }) {
  return <div className="ppf-working-times">{value.map((interval, index) => <div className="ppf-fields" key={index}>
    <label>From<input aria-label={`${name} interval ${index + 1} from`} type="time" step="1" required value={interval.from || ''} onChange={event => onChange(value.map((item, position) => position === index ? { ...item, from: fullTime(event.target.value) } : item))} /></label>
    <label>To<input aria-label={`${name} interval ${index + 1} to`} type="time" step="1" required value={interval.to || ''} onChange={event => onChange(value.map((item, position) => position === index ? { ...item, to: fullTime(event.target.value) } : item))} /></label>
    <button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove {name} interval {index + 1}</button>
  </div>)}<button type="button" onClick={() => onChange([...value, { from: '', to: '' }])}>Add {name} interval</button></div>
}
WorkingTimes.propTypes = { value: PropTypes.array, onChange: PropTypes.func.isRequired, name: PropTypes.string.isRequired }

export default function PlanningProfileCalendar({ value, onChange }) {
  const calendar = value || emptyProfileCalendar()
  const workingDays = calendar.working_weekdays || []
  const exceptions = calendar.exceptions || []
  const setException = (index, fields) => onChange({ ...calendar, exceptions: exceptions.map((item, position) => position === index ? { ...item, ...fields } : item) })
  return <section className="ppf-calendar" aria-label="Explicit profile calendar"><p>Enter the reviewed work calendar. Native scheduling exports require explicit working-time intervals; no shifts are supplied automatically.</p>
    <fieldset className="ppf-rules"><legend>Working weekdays</legend>{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={workingDays.includes(index)} onChange={event => {
      const nextTimes = { ...(calendar.working_times || {}) }
      if (!event.target.checked) delete nextTimes[String(index)]
      onChange({ ...calendar, working_weekdays: event.target.checked ? [...workingDays, index].sort() : workingDays.filter(value => value !== index), working_times: nextTimes })
    }} />{day}</label>)}</fieldset>
    <div className="ppf-fields"><label>Working hours per day<input aria-label="Profile working hours per day" type="number" required min="0" max="24" step="any" value={calendar.hours_per_day ?? ''} onChange={event => onChange({ ...calendar, hours_per_day: event.target.value === '' ? '' : Number(event.target.value) })} /></label><label>IANA timezone<input aria-label="Profile calendar timezone" required value={calendar.timezone || ''} onChange={event => onChange({ ...calendar, timezone: event.target.value })} /></label></div>
    {workingDays.map(day => <fieldset key={day} className="ppf-rules"><legend>{weekdays[day]} working times</legend><WorkingTimes name={weekdays[day]} value={calendar.working_times?.[String(day)] || []} onChange={intervals => onChange({ ...calendar, working_times: { ...(calendar.working_times || {}), [String(day)]: intervals } })} /></fieldset>)}
    <details><summary>Calendar exceptions ({exceptions.length})</summary>{exceptions.map((exception, index) => <fieldset className="ppf-rules" key={index}><legend>Exception {index + 1}</legend><div className="ppf-fields"><label>Date<input aria-label={`Calendar exception ${index + 1} date`} required type="date" value={exception.date || ''} onChange={event => setException(index, { date: event.target.value })} /></label><label>Working day<select aria-label={`Calendar exception ${index + 1} working day`} required value={exception.is_working == null ? '' : String(exception.is_working)} onChange={event => setException(index, { is_working: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">Not Specified</option><option value="true">Working</option><option value="false">Nonworking</option></select></label></div>
      {exception.is_working === true && <><label>Working hours<input aria-label={`Calendar exception ${index + 1} working hours`} type="number" min="0" max="24" step="any" value={exception.working_hours ?? ''} onChange={event => setException(index, { working_hours: event.target.value === '' ? null : Number(event.target.value) })} /></label><WorkingTimes name={`Exception ${index + 1}`} value={exception.working_times || []} onChange={intervals => setException(index, { working_times: intervals })} /></>}
      <button type="button" onClick={() => onChange({ ...calendar, exceptions: exceptions.filter((_, position) => position !== index) })}>Remove exception {index + 1}</button>
    </fieldset>)}<button type="button" onClick={() => onChange({ ...calendar, exceptions: [...exceptions, { date: '', is_working: null, working_hours: null, working_times: [] }] })}>Add calendar exception</button></details>
  </section>
}
PlanningProfileCalendar.propTypes = { value: PropTypes.object, onChange: PropTypes.func.isRequired }
