/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowPathIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fullDate = date => date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const shortDate = date => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const safeRoute = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
  && ![...value].some(character => character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ? value : null;

export function parseWorkHubDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  if (typeof value !== 'string') return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/);
  if (!parts) return null;
  const [, year, month, day] = parts.map(Number);
  const result = new Date(year, month - 1, day, 12);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

export function buildWorkHubMonth(month) {
  const current = parseWorkHubDate(month) || parseWorkHubDate(new Date());
  const start = new Date(current.getFullYear(), current.getMonth(), 1, 12);
  const offset = (start.getDay() + 6) % 7;
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => new Date(start.getFullYear(), start.getMonth(), 1 - offset + index, 12));
}

export function normalizeWorkHubCalendarEvents(rows) {
  let invalidCount = 0;
  const events = [];
  for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
    const start = parseWorkHubDate(row?.date);
    const end = row?.end_date ? parseWorkHubDate(row.end_date) : start;
    if (!start || !end || end < start || !['leave', 'holiday'].includes(row?.kind)) { invalidCount += 1; continue; }
    events.push({ ...row, _key: `${row.id ?? index}-${index}`, start, end,
      title: typeof row.title === 'string' && row.title.trim() ? row.title : row.kind === 'leave' ? 'Leave' : 'Public holiday' });
  }
  return { events: events.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title)), invalidCount };
}

export function workHubEventsOnDate(events, date) {
  const day = parseWorkHubDate(date);
  return day ? events.filter(event => event.start <= day && event.end >= day) : [];
}

export default function WorkHubCalendar({ source, month, onMonthChange, onRetry, onOpenFull, expanded = false }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const today = parseWorkHubDate(new Date());
  const shownMonth = parseWorkHubDate(month) || today;
  const days = buildWorkHubMonth(shownMonth);
  const ready = source?.state === 'ready' && Array.isArray(source.events);
  const { events, invalidCount } = normalizeWorkHubCalendarEvents(ready ? source.events : []);
  const selectedDate = selectedDay ? parseWorkHubDate(selectedDay) : null;
  const matching = selectedDate ? workHubEventsOnDate(events, selectedDate) : events.filter(event => event.end >= today);
  const visible = expanded ? matching : matching.slice(0, 5);
  const monthLabel = shownMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = amount => {
    setSelectedDay(null);
    onMonthChange?.(new Date(shownMonth.getFullYear(), shownMonth.getMonth() + amount, 1, 12));
  };
  const chooseDay = date => {
    setSelectedDay(dayKey(date));
    if (date.getMonth() !== shownMonth.getMonth() || date.getFullYear() !== shownMonth.getFullYear()) {
      onMonthChange?.(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    }
  };
  const showToday = () => {
    setSelectedDay(dayKey(today));
    onMonthChange?.(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  };

  return <section className="wh-panel wh-calendar-panel" aria-label="HR Calendar" data-testid="workhub-calendar">
    <div className="wh-panel-heading"><h2><CalendarDaysIcon aria-hidden="true" />HR Calendar</h2>
      {!expanded && <button type="button" className="wh-text-button" onClick={() => onOpenFull?.()}>View full calendar<ChevronRightIcon aria-hidden="true" /></button>}
    </div>
    <div className="wh-calendar-toolbar"><button type="button" className="wh-calendar-nav-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeftIcon aria-hidden="true" /></button>
      <span className="wh-calendar-title" aria-live="polite">{monthLabel}</span>
      <button type="button" className="wh-calendar-nav-button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRightIcon aria-hidden="true" /></button>
      <button type="button" className="wh-calendar-today wh-text-button" onClick={showToday} aria-label="Show today">Today</button>
    </div>
    <table className="wh-calendar-grid" aria-label={`${monthLabel} calendar`}><thead className="wh-calendar-weekdays"><tr>
      {WEEKDAYS.map(day => <th key={day} scope="col" abbr={day}>{day.slice(0, 3)}</th>)}
    </tr></thead><tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(date => {
      const key = dayKey(date);
      const listed = workHubEventsOnDate(events, date);
      const kinds = [...new Set(listed.map(event => event.kind))];
      const selected = selectedDay === key;
      const isToday = dayKey(today) === key;
      const outside = shownMonth.getMonth() !== date.getMonth();
      return <td key={key}><button type="button" className={`wh-calendar-day${outside ? ' wh-calendar-day--outside' : ''}${isToday ? ' wh-calendar-day--today' : ''}${selected ? ' wh-calendar-day--selected' : ''}`}
        data-date={key} aria-label={`${fullDate(date)}${ready ? `, ${listed.length} listed ${listed.length === 1 ? 'event' : 'events'}` : ''}`}
        aria-pressed={selected} aria-current={isToday ? 'date' : undefined} onClick={() => chooseDay(date)}>
        <span>{date.getDate()}</span><span className="wh-calendar-dots" aria-hidden="true">{kinds.map(kind => <i key={kind} className={`wh-calendar-dot wh-calendar-dot--${kind}`} />)}</span>
      </button></td>;
    })}</tr>)}</tbody></table>
    <div className="wh-calendar-legend"><span><i className="wh-calendar-dot wh-calendar-dot--leave" aria-hidden="true" />Leave</span>
      <span><i className="wh-calendar-dot wh-calendar-dot--holiday" aria-hidden="true" />Public holiday</span></div>
    <div className="wh-calendar-events-heading"><h3>{selectedDate ? shortDate(selectedDate) : 'Upcoming events'}</h3>
      {selectedDate && <button type="button" className="wh-text-button" onClick={() => setSelectedDay(null)}>Show upcoming</button>}</div>
    {source?.state === 'loading' ? <p className="wh-panel-loading" role="status"><ArrowPathIcon aria-hidden="true" />Loading calendar…</p>
      : source?.state === 'error' ? <div className="wh-panel-error" role="alert"><InformationCircleIcon aria-hidden="true" /><p>{source.message || 'Calendar could not be loaded.'}</p>
        <button type="button" className="wh-text-button" onClick={() => onRetry?.()}>Retry calendar</button></div>
        : !ready ? <div className="wh-panel-empty"><InformationCircleIcon aria-hidden="true" /><p>{source?.message || 'Calendar is not available.'}</p></div>
          : <>
            {visible.length ? <ul className="wh-calendar-events" data-testid="workhub-calendar-events">{visible.map(event => {
              const route = safeRoute(event.href);
              return <li key={event._key} className="wh-calendar-event" data-kind={event.kind}>
                <i className={`wh-calendar-dot wh-calendar-dot--${event.kind}`} aria-hidden="true" />
                <time className="wh-calendar-event-date" dateTime={dayKey(event.start)}>{shortDate(event.start)}</time>
                <div className="wh-calendar-event-copy">{route ? <Link to={route}>{event.title}</Link> : <strong>{event.title}</strong>}
                  {dayKey(event.start) !== dayKey(event.end) && <span>to {shortDate(event.end)}</span>}
                </div>
              </li>;
            })}</ul> : <div className="wh-panel-empty"><InformationCircleIcon aria-hidden="true" /><p>{invalidCount && !events.length ? 'Event dates are not available.' : selectedDate ? 'No events listed for this day.' : 'No upcoming events in this preview.'}</p></div>}
            {source.message && <p className="wh-calendar-note">{source.message}</p>}
            {invalidCount > 0 && <p className="wh-calendar-note">Some event dates are not available.</p>}
            {source.truncated && <p className="wh-calendar-note">Some events are outside this preview.</p>}
          </>}
    {ready && <div className="wh-calendar-footer"><span>{visible.length} of {matching.length} listed events</span></div>}
  </section>;
}
