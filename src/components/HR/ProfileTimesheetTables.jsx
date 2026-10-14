import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, CalendarDays, RotateCcw } from 'lucide-react';
import { fetchUserHistory } from '../../services/timesheet.service';
import { HR_TIMESHEET_ACTIVITY_COLUMNS, HR_TIMESHEET_DAILY_COLUMNS, HR_TIMESHEET_ACTIVITY_SORT, HR_TIMESHEET_VISUALS, HR_TIMESHEET_COPY } from '../../config/hrEmployees.config';
import './ProfileTimesheetTables.css';

const activityColumns = HR_TIMESHEET_ACTIVITY_COLUMNS.map(column => column.id === 'status' ? HR_TIMESHEET_DAILY_COLUMNS.find(item => item.id === 'punches') : column);
const attendanceColumns = HR_TIMESHEET_DAILY_COLUMNS.map(column => column.id === 'punches' ? HR_TIMESHEET_ACTIVITY_COLUMNS.find(item => item.id === 'status') : column);


function useHistory(profile, from, to) {
  const [state, setState] = useState({ rows: [], loading: true, error: '' });
  const userId = profile?.user?.id;
  const employeeCode = profile?.employee_id || profile?.engineer_profile?.employee_code;
  const email = profile?.user?.email || profile?.email;
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    if (!userId && !employeeCode && !email) {
      setState({ rows: [], loading: false, error: 'Your employee identity is not available yet.' });
      return;
    }
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await fetchUserHistory({ user_id: userId || undefined, employee_code: employeeCode || undefined, email: email || undefined, from, to });
        if (!cancelled) setState({ rows: data.rows || [], loading: false, error: data.error || (data.configured === false ? 'Attendance data is currently unavailable.' : '') });
      } catch {
        if (!cancelled) setState({ rows: [], loading: false, error: HR_TIMESHEET_COPY.errorState });
      } finally { pending = false; }
    };
    setState({ rows: [], loading: true, error: '' });
    refresh();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [userId, employeeCode, email, from, to]);
  return state;
}

const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function ProfileTimesheetTables({ profile }) {
  const [day, setDay] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const dayKey = localDate(day);
  const daily = useHistory(profile, dayKey, dayKey);
  const attendance = useHistory(profile, localDate(month), localDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)));
  const moveDay = offset => setDay(previous => new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + offset, 12));
  const moveMonth = offset => setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() + offset, 1, 12));
  const attendanceRows = attendance.rows.map(row => {
    const hours = Number(row.total_presence_hours ?? row.hours_worked ?? row.hours ?? 0);
    const bands = HR_TIMESHEET_VISUALS.hourBands;
    return { ...row, __bandLabel: (bands.find(band => hours <= band.upTo) || bands[bands.length - 1])?.label || '' };
  });
  const activity = [...daily.rows].sort((a, b) => HR_TIMESHEET_ACTIVITY_SORT === 'asc' ? String(a.date || '').localeCompare(String(b.date || '')) : String(b.date || '').localeCompare(String(a.date || '')));
  const resetPeriod = () => {
    const today = new Date();
    setDay(today);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };
  const currentPeriod = dayKey === localDate(new Date()) && month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();
  return <div className="work-attendance-workspace">
    <header className="work-attendance-heading">
      <div className="work-attendance-title"><span className="work-attendance-icon"><CalendarDays aria-hidden="true" /></span><div><h2>Work &amp; Attendance</h2><p>Your daily activity and monthly attendance, synced with HR.</p></div></div>
      <button type="button" onClick={resetPeriod} disabled={currentPeriod} className="work-attendance-today"><RotateCcw aria-hidden="true" /> Back to today</button>
    </header>
    <div className="profile-timesheet-tables">
    {[
      { title: HR_TIMESHEET_COPY.activityTitle, columns: activityColumns, rows: activity, state: daily, unit: 'day', move: moveDay, period: day.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'}) },
      { title: HR_TIMESHEET_COPY.dailyTitle, columns: attendanceColumns, rows: attendanceRows, state: attendance, unit: 'month', move: moveMonth, period: month.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'}) },
    ].map(({title, columns, rows, state, unit, move, period}) => <section key={title} className="profile-timesheet-panel" aria-label={title}>
      <header className="timesheet-period-heading"><h2>{title}</h2>
        <div className="timesheet-period-nav" role="group" aria-label={`${title} period`}>
          <button type="button" onClick={() => move(-1)} aria-label={`Previous ${unit}`} title={`Previous ${unit}`}><ChevronLeft aria-hidden="true" /></button>
          <span aria-live="polite">{period}</span>
          <button type="button" onClick={() => move(1)} aria-label={`Next ${unit}`} title={`Next ${unit}`}><ChevronRight aria-hidden="true" /></button>
        </div>
      </header>
      <div className="profile-timesheet-scroll" tabIndex={0} role="region" aria-label={`${title} records`}>
        <table aria-label={title} aria-busy={state.loading}>
          <thead><tr>{columns.map(column => <th key={column.id} scope="col">{column.label}</th>)}</tr></thead>
          <tbody>{state.loading || state.error || !rows.length ? <tr><td colSpan={columns.length}><span role="status">{state.loading ? HR_TIMESHEET_COPY.loadingState : state.error || HR_TIMESHEET_COPY.emptyState}</span></td></tr> : rows.map((row, index) => <tr key={`${row.date}-${index}`} className={unit === 'month' && row.date === dayKey ? 'selected-attendance-day' : undefined}>
            {columns.map(column => <td key={column.id} className={column.mono ? 'tabular-nums' : undefined}>{unit === 'month' && column.id === 'date' ? <button type="button" className="attendance-day-link" aria-label={`View activity for ${row.date}`} aria-pressed={row.date === dayKey} onClick={() => setDay(new Date(`${row.date}T12:00:00`))}>{column.accessor(row)}</button> : column.accessor(row)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>)}
    </div>
  </div>;
}
ProfileTimesheetTables.propTypes = { profile: PropTypes.object };
