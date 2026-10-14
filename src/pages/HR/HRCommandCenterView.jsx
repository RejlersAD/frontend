/* eslint-disable react/prop-types */
import * as HeroIcons from "@heroicons/react/24/outline";
import { useMemo, useRef, useState } from "react";
import { attendanceAvailability, buildDailyObservation, buildAttendancePattern, buildDepartmentReadiness } from "./hrWorkforcePresentation";
import "./HRCommandCenterView.css";
const Icon = ({
  name,
  className = ""
}) => {
  const Component = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon;
  return <Component className={className} aria-hidden="true" />;
};
const count = value => {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const display = value => value == null ? "Unavailable" : value.toLocaleString("en-GB");
const ratio = (value, total) => value != null && total > 0 ? Math.round(value / total * 100) : null;
const employeeName = row => row?.employee_name || row?.radai_full_name || row?.name || [row?.first_name, row?.last_name].filter(Boolean).join(" ") || row?.employee_code || "Employee";
const dateKey = value => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatDate = value => value ? new Date(value).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric"
}) : "Date pending";
const formatTime = value => {
  if (!value) return "—";
  const parts = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (parts) return `${String(Number(parts[1]) % 12 || 12).padStart(2, "0")}:${parts[2]} ${Number(parts[1]) >= 12 ? "PM" : "AM"}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
};
const weekNumber = value => {
  const d = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
};
const csvCell = value => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
const downloadDashboardCsv = ({
  workforce,
  daily,
  monthRollup
}) => {
  const lines = [
    ["HR Command Center export"],
    ["Generated", new Date().toISOString()],
    [],
    ["Workforce"],
    ["Employee", "Department", "Status", "Email"],
    ...workforce.map(employee => [
      employeeName(employee), employee.department || "", employee.status || "",
      employee.email || employee.user?.email || ""
    ]),
    [],
    ["Today's attendance"],
    ["Employee", "Department", "First in", "Hours", "Late", "Full day"],
    ...daily.map(row => [
      employeeName(row), row.department || "",
      row.first_in || row.punch_time || row.login_time || "",
      row.hours_worked ?? row.total_hours ?? row.regular_hours ?? "",
      typeof row.is_late === "boolean" ? (row.is_late ? "Yes" : "No") : "",
      typeof row.is_full_day === "boolean" ? (row.is_full_day ? "Yes" : "No") : ""
    ]),
    [],
    ["Month to date"],
    ["Total hours", monthRollup.totalHours],
    ["Average hours per employee", monthRollup.avgHoursPerEmployee],
    ["Full days", monthRollup.totalFull],
    ["Late arrivals", monthRollup.totalLate]
  ];
  const blob = new Blob([lines.map(line => line.map(csvCell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8"
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `hr-command-center-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(href);
};
const Button = ({
  children,
  icon,
  primary = false,
  onClick,
  disabled = false,
  ...props
}) => <button type="button" className={`hr-wi-button${primary ? " is-primary" : ""}`} onClick={onClick} disabled={disabled} {...props}>
    {icon && <Icon name={icon} />} {children}
  </button>;
const Panel = ({
  title,
  subtitle,
  icon,
  action,
  children,
  className = ""
}) => <section className={`hr-wi-panel ${className}`} aria-label={title}>
    <header className="hr-wi-panel-heading">
      <span className="hr-wi-icon"><Icon name={icon} /></span>
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action && <div className="hr-wi-panel-action">{action}</div>}
    </header>
    {children}
  </section>;
const EmptyRow = ({
  colSpan,
  children
}) => <tr><td colSpan={colSpan} className="hr-wi-empty">{children}</td></tr>;
const ReviewButton = ({
  onClick,
  children = "Review",
  label
}) => <button className="hr-wi-review" type="button" onClick={onClick} aria-label={label}>{children}</button>;
const MetricCard = ({
  icon,
  tone,
  label,
  value,
  detail,
  onClick
}) => <button type="button" className="hr-wi-metric" onClick={onClick}>
    <span className={`hr-wi-icon is-${tone}`}><Icon name={icon} /></span>
    <span className="hr-wi-metric-copy"><span className="hr-wi-metric-label">{label}</span><strong className={value === "Unavailable" ? "is-unavailable" : ""}>{value}</strong><span className="hr-wi-metric-detail">{detail}</span></span>
  </button>;
function AttendanceChart({
  points,
  loading
}) {
  const maximum = Math.max(4, ...points.map(point => point.present || 0));
  const ceiling = Math.ceil(maximum / 4) * 4;
  const width = 620,
    left = 34,
    right = 8,
    top = 16,
    bottom = 113;
  const step = (width - left - right) / points.length;
  const hasEvidence = points.some(point => point.available);
  return <div className="hr-wi-chart" aria-busy={loading}>
    <div className="hr-wi-chart-legend"><span><i />Recorded present</span><span className="is-muted">Scheduled / attendance %: unavailable</span></div>
    <svg viewBox="0 0 620 159" role="img" aria-label={loading ? "Loading attendance pattern" : "Recorded attendance by day; missing dates have no bar. Scheduled counts and attendance percentages are unavailable."}>
      {[0, 1, 2, 3, 4].map(tick => {
        const y = bottom - (bottom - top) * tick / 4;
        return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} className="hr-wi-chart-grid" /><text x={left - 8} y={y + 4} textAnchor="end">{ceiling * tick / 4}</text></g>;
      })}
      {points.map((point, index) => {
        const x = left + step * index,
          height = point.present == null ? 0 : point.present / ceiling * (bottom - top),
          date = new Date(`${point.date}T12:00:00`);
        return <g key={point.date}>
        {index === points.length - 1 && <rect x={x + 2} y={top - 8} width={step - 4} height={139} rx="5" className="hr-wi-chart-current" />}
        <line x1={x} x2={x} y1={top} y2={bottom} className="hr-wi-chart-grid" />
        {point.present != null && <rect x={x + step * .25} y={bottom - height} width={Math.max(3, step * .5)} height={height} fill="url(#hr-attendance-blue)"><title>{point.date}: {point.present} recorded present</title></rect>}
        {(points.length <= 7 || index % 5 === 0 || index === points.length - 1) && <><text x={x + step / 2} y={bottom + 17} textAnchor="middle">{date.toLocaleDateString("en-GB", {
                weekday: "short"
              })}</text><text x={x + step / 2} y={bottom + 31} textAnchor="middle">{date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short"
              })}</text></>}
        {points.length <= 7 && <text x={x + step / 2} y={point.present == null ? bottom - 8 : Math.max(top - 2, bottom - height - 5)} textAnchor="middle" className="hr-wi-chart-value">{point.present ?? "—"}</text>}
      </g>;
      })}
      <defs><linearGradient id="hr-attendance-blue" x1="0" x2="1"><stop stopColor="#1587ff" /><stop offset="1" stopColor="#0054ff" /></linearGradient></defs>
    </svg>
    {!hasEvidence && <p className="hr-wi-chart-empty">{loading ? "Loading attendance records…" : "Daily history unavailable in the loaded records."}</p>}
    <details className="hr-wi-chart-data"><summary>View chart data</summary><table><thead><tr><th>Date</th><th>Recorded present</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{display(point.present)}</td></tr>)}</tbody></table></details>
  </div>;
}
export default function HRCommandCenterView({
  workforce = [],
  live,
  daily,
  monthly,
  lifecycleRequests = [],
  pending,
  monthRollup,
  totalPending,
  autoRefresh,
  setAutoRefresh,
  now,
  loading,
  workforceError,
  timesheetError,
  lastUpdated,
  onRetryWorkforce,
  onRefresh,
  onOpenReport,
  navigate
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [period, setPeriod] = useState(7);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const decisionRef = useRef(null);
  const today = new Date(now || new Date());
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);
  const dailyState = useMemo(() => buildDailyObservation(daily), [daily]);
  const liveState = attendanceAvailability(live);
  const workforceAvailable = !workforceError && (!loading || workforce.length > 0);
  const active = workforceAvailable ? workforce.filter(employee => employee.status === "active").length : null;
  const present = liveState.available ? count(live?.summary?.currently_in) : null;
  const seen = liveState.available ? count(live?.summary?.total_seen_today) : null;
  const attendanceRate = ratio(seen, active);
  const presentRate = ratio(present, active);
  const notCheckedIn = active != null && seen != null ? Math.max(0, active - seen) : null;
  const late = dailyState.available ? dailyState.late : null;
  const dailyRows = dailyState.rows || [];
  const attentionRows = dailyRows.filter(row => row.is_late || row.is_full_day === false).sort((a, b) => Number(Boolean(b.is_late)) - Number(Boolean(a.is_late))).slice(0, 4);
  const chartPoints = useMemo(() => buildAttendancePattern(monthly, new Date(`${todayKey}T12:00:00`), period), [monthly, todayKey, period]);
  const departments = useMemo(() => buildDepartmentReadiness(daily, live), [daily, live]);
  const recentChanges = useMemo(() => workforce.flatMap(employee => [employee.join_date && {
    ...employee,
    changeType: "Joined",
    effectiveDate: employee.join_date
  }, employee.exit_date && {
    ...employee,
    changeType: "Exited",
    effectiveDate: employee.exit_date
  }]).filter(Boolean).filter(row => dateKey(row.effectiveDate) <= todayKey).sort((a, b) => dateKey(b.effectiveDate).localeCompare(dateKey(a.effectiveDate))).slice(0, 5), [workforce, todayKey]);
  const calendarItems = [...lifecycleRequests.map(row => ({
    ...row,
    kind: row.request_type || "Onboarding",
    date: row.effective_date || row.joining_date || row.created_at,
    route: String(row.request_type).toLowerCase() === "offboarding" ? `/hr/onboarding?tab=offboarding&record_id=${row.request_id}` : `/hr/onboarding?tab=onboarding&user_id=${row.user_id}&record_id=${row.request_id}`
  })), ...(pending?.pendingLeave || []).map(row => ({
    ...row,
    kind: "Leave request",
    date: row.start_date,
    route: row.id ? `/hr/leave-requests/${encodeURIComponent(row.id)}` : "/hr/leave-requests"
  }))].filter(row => row.date);
  const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(1 - (monthStart.getDay() + 6) % 7);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const weeks = Array.from({
    length: Math.ceil(((monthStart.getDay() + 6) % 7 + monthEnd.getDate()) / 7)
  }, (_, week) => Array.from({
    length: 7
  }, (_, day) => {
    const d = new Date(calendarStart);
    d.setDate(d.getDate() + week * 7 + day);
    return d;
  }));
  const actionItems = [{
    label: "Onboarding cases",
    count: lifecycleRequests.filter(row => String(row.request_type).toLowerCase() === "onboarding").length,
    detail: "active onboarding cases need review",
    route: "/hr/onboarding",
    source: "Onboarding"
  }, {
    label: "Offboarding cases",
    count: lifecycleRequests.filter(row => String(row.request_type).toLowerCase() === "offboarding").length,
    detail: "offboarding cases need review",
    route: "/hr/onboarding?tab=offboarding",
    source: "Offboarding"
  }, {
    label: "Leave requests",
    count: count(pending?.pendingLeaveCount),
    detail: "leave requests require review",
    route: pending?.pendingLeaveCount === 1 && pending?.pendingLeave?.[0]?.id ? `/hr/leave-requests/${encodeURIComponent(pending.pendingLeave[0].id)}` : "/hr/leave-requests",
    source: "Leave"
  }, {
    label: "Overtime requests",
    count: count(pending?.pendingOvertimeCount),
    detail: "overtime requests awaiting approval",
    route: "/hr/leave?view=encashment&ot_status=pending",
    source: "Overtime"
  }, {
    label: "Attendance exceptions",
    count: late,
    detail: "attendance exceptions require confirmation",
    route: "/hr/employees?tab=timesheet",
    source: "Attendance · Today"
  }].filter(item => item.count > 0);
  const dashboardActions = loading && !actionItems.length ? null : Math.max(totalPending || 0, actionItems.reduce((sum, item) => sum + item.count, 0));
  const decisionItems = [...actionItems, {
    label: "Missing check-ins",
    count: notCheckedIn,
    route: "/hr/employees?tab=timesheet"
  }, {
    label: "HR actions due",
    count: dashboardActions,
    route: "/hr/payroll"
  }];
  const notice = actionItems[noticeIndex % Math.max(1, actionItems.length)];
  const statusItems = [{
    icon: "CheckCircleIcon",
    tone: "green",
    label: "On time",
    value: dailyState.onTime
  }, {
    icon: "ClockIcon",
    tone: "amber",
    label: "Late",
    value: late
  }, {
    icon: "CalendarDaysIcon",
    tone: "blue",
    label: "Leave",
    value: null,
    note: "Approved leave coverage is not supplied by this feed."
  }, {
    icon: "UserPlusIcon",
    tone: "slate",
    label: "Not checked in",
    value: notCheckedIn
  }];
  const statusTotal = statusItems.reduce((sum, item) => sum + (item.value || 0), 0);
  const refreshedSeconds = lastUpdated ? Math.max(0, Math.floor((new Date(now) - new Date(lastUpdated)) / 1000)) : null;
  const incompleteSources = timesheetError || workforceError || !dailyState.available || !liveState.available;
  const refreshedText = loading ? "Refreshing data…" : incompleteSources ? "Some data unavailable" : refreshedSeconds == null ? "Awaiting first refresh" : refreshedSeconds < 60 ? "Data refreshed just now" : `Data refreshed ${Math.floor(refreshedSeconds / 60)} min ago`;
  return <div className="hr-workforce-intelligence" data-table-typography="preserve" aria-busy={loading}>
    <header className="hr-wi-header">
      <div className="hr-wi-title"><h1>Workforce Intelligence</h1><p>Availability, capacity, attendance signals and people movements.</p></div>
      <div className="hr-wi-toolbar"><div className="hr-wi-toolbar-actions">
        <span className="hr-wi-button hr-wi-today"><Icon name="CalendarDaysIcon" />Today · {formatDate(today)}</span>
        <button type="button" className="hr-wi-button" aria-pressed={autoRefresh} onClick={() => setAutoRefresh(value => !value)}><i className={`hr-wi-dot${autoRefresh ? "" : " is-off"}`} />Auto-refresh {autoRefresh ? "on" : "off"}</button>
        <Button icon="ArrowPathIcon" onClick={onRefresh} disabled={loading}>Refresh</Button>
        <Button icon="ArrowDownTrayIcon" onClick={() => downloadDashboardCsv({
            workforce,
            daily: dailyRows,
            monthRollup
          })} disabled={loading || Boolean(workforceError)}>Export</Button>
        <Button icon="PlusIcon" primary onClick={() => navigate("/hr/onboarding?tab=create")}>Add employee</Button>
      </div><p className="hr-wi-freshness" role="status"><i className={`hr-wi-dot${incompleteSources ? " is-off" : ""}`} />{refreshedText}</p></div>
    </header>
    {(workforceError || timesheetError) && <div className="hr-wi-error" role="alert"><Icon name="ExclamationTriangleIcon" /><span>{workforceError ? "The workforce directory could not be loaded. Check your HR access or retry." : "Attendance data is temporarily unavailable. Previously loaded records may be stale."}</span><Button onClick={workforceError ? onRetryWorkforce : onRefresh}>Retry</Button></div>}
    <section className="hr-wi-metrics" aria-label="Workforce summary">
      <MetricCard icon="UserGroupIcon" tone="blue" label="Active workforce" value={display(active)} detail="Current workforce" onClick={() => onOpenReport("active")} />
      <MetricCard icon="UserIcon" tone="violet" label="Available now" value={display(present)} detail={presentRate == null ? "Current check-in evidence unavailable" : `${presentRate}% of active employees · checked in`} onClick={() => onOpenReport("currently_in")} />
      <MetricCard icon="ChartBarIcon" tone="green" label="Attendance coverage" value={attendanceRate == null ? "Unavailable" : `${attendanceRate}%`} detail={seen == null || active == null ? "Attendance evidence unavailable" : `${seen} of ${active} active employees`} onClick={() => onOpenReport("attendance_rate")} />
      <MetricCard icon="ClipboardDocumentListIcon" tone="rose" label="Signals requiring review" value={display(dashboardActions)} detail="Human review required" onClick={() => {
        decisionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        decisionRef.current?.focus({
          preventScroll: true
        });
      }} />
    </section>
    <div className="hr-wi-grid hr-wi-top-grid">
      <Panel title="Workforce outlook" subtitle="Evidence: attendance records · Local time" icon="UserGroupIcon" action={<span className="hr-wi-period-label">Today</span>}>
        <div className="hr-wi-outlook-stats">{statusItems.map(item => <div className="hr-wi-outlook-stat" key={item.label} title={item.note}><span className={`hr-wi-icon is-${item.tone}`}><Icon name={item.icon} /></span><div><span>{item.label}</span><strong className={item.value == null ? "is-unavailable" : ""}>{display(item.value)}</strong></div>{item.value != null && active > 0 && <small>{ratio(item.value, active)}%</small>}</div>)}</div>
        <div className="hr-wi-status-bar" aria-label="Distribution of available attendance signals">{statusItems.map(item => <span key={item.label} className={`is-${item.tone}`} style={{
            width: `${statusTotal ? (item.value || 0) / statusTotal * 100 : 0}%`
          }} />)}</div>
        <div className="hr-wi-attention-title">Employees requiring attention ({attentionRows.length})</div>
        <div className="hr-wi-table-wrap"><table><thead><tr><th>Name</th><th>Department</th><th>Status</th><th>Time</th><th className="hr-wi-right">Action</th></tr></thead><tbody>{attentionRows.length ? attentionRows.map((row, index) => <tr key={row.id || row.employee_code || index}><td>{employeeName(row)}</td><td>{row.department || "—"}</td><td><span className={`hr-wi-badge ${row.is_late ? "is-amber" : "is-blue"}`}>{row.is_late ? "Late" : "Partial day"}</span></td><td className="hr-wi-nowrap">{formatTime(row.first_in || row.punch_time || row.login_time)}</td><td className="hr-wi-right"><ReviewButton onClick={() => navigate("/hr/employees?tab=timesheet")} label={`Review attendance for ${employeeName(row)}`} /></td></tr>) : <EmptyRow colSpan={5}>{loading ? "Loading attendance…" : dailyState.available ? "No exceptions in the loaded attendance records." : "Attendance records unavailable."}</EmptyRow>}</tbody></table></div>
      </Panel>
      <Panel title="HR calendar" subtitle="Onboarding, offboarding and leave" icon="CalendarDaysIcon" action={<button type="button" className="hr-wi-calendar-add" aria-label="Add HR event" title="Open employee onboarding" onClick={() => navigate("/hr/onboarding?tab=create")}><Icon name="PlusIcon" /></button>}>
        <div className="hr-wi-calendar"><div className="hr-wi-calendar-nav"><button type="button" aria-label="Previous month" onClick={() => setMonthOffset(value => value - 1)}><Icon name="ChevronLeftIcon" /></button><h3>{monthStart.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric"
              })}</h3><button type="button" aria-label="Next month" onClick={() => setMonthOffset(value => value + 1)}><Icon name="ChevronRightIcon" /></button></div>
          <div className="hr-wi-calendar-week hr-wi-calendar-labels">{["Week", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <span key={day} className={index >= 6 ? "is-weekend" : ""}>{day}</span>)}</div>
          {weeks.map(week => <div className="hr-wi-calendar-week" key={dateKey(week[0])}><span className="hr-wi-weeknumber">{weekNumber(week[0])}</span>{week.map((date, index) => {
              const items = calendarItems.filter(item => dateKey(item.date) === dateKey(date)),
                isToday = dateKey(date) === todayKey;
              return <button type="button" key={dateKey(date)} disabled={!items.length} onClick={() => items[0] && navigate(items[0].route)} aria-label={`${formatDate(date)}${items.length ? `: ${items.map(item => `${item.kind}: ${employeeName(item)}`).join(", ")}` : ""}`} aria-current={isToday ? "date" : undefined} className={`${index >= 5 ? "is-weekend " : ""}${date.getMonth() !== monthStart.getMonth() ? "is-adjacent" : ""}`} title={items.map(item => `${item.kind}: ${employeeName(item)}`).join("\n") || undefined}><span className={isToday ? "is-today" : ""}>{date.getDate()}</span>{items.length > 0 && <i />}</button>;
            })}</div>)}
        </div>
      </Panel>
    </div>
    <div className="hr-wi-grid hr-wi-middle-grid">
      <Panel title="Attendance pattern" subtitle="Observed records · Missing days remain unavailable" icon="ChartBarIcon" action={<div className="hr-wi-tabs" role="group" aria-label="Attendance history period">{[[1, "Today"], [7, "7 days"], [30, "30 days"]].map(([days, label]) => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{label}</button>)}</div>}>
        <AttendanceChart points={chartPoints} loading={loading} />
      </Panel>
      <Panel title="People movements" subtitle={`Employment dates from the employee directory · ${recentChanges.length} items`} icon="UserGroupIcon" action={<button type="button" className="hr-wi-link" onClick={() => navigate("/hr/employees")}>Open employee directory</button>}>
        <div className="hr-wi-table-wrap"><table><thead><tr><th>Name</th><th>Department</th><th>Type</th><th>Effective date</th></tr></thead><tbody>{recentChanges.length ? recentChanges.map((row, index) => <tr key={`${row.id}-${index}`}><td>{employeeName(row)}</td><td>{row.department || "—"}</td><td><span className={`hr-wi-badge ${row.changeType === "Joined" ? "is-green" : "is-rose"}`}>{row.changeType}</span></td><td className="hr-wi-nowrap">{formatDate(row.effectiveDate)}</td></tr>) : <EmptyRow colSpan={4}>{loading ? "Loading employee records…" : workforceError ? "Employee records unavailable." : "No recorded people movements."}</EmptyRow>}</tbody></table></div>
      </Panel>
    </div>
    <div className="hr-wi-grid hr-wi-bottom-grid">
      <Panel title="Workforce readiness by department" subtitle="Current attendance status and exceptions · Evidence: attendance records" icon="BuildingOffice2Icon">
        <div className="hr-wi-table-wrap"><table><thead><tr><th>Department</th><th>Present</th><th>Exceptions</th><th>Data coverage</th><th className="hr-wi-right">Next action</th></tr></thead><tbody>{departments.length ? departments.map(row => <tr key={row.department}><td>{row.department}</td><td>{row.present ?? "—"}</td><td className={row.late > 0 ? "hr-wi-warning" : ""}>{row.late == null ? "Unavailable" : `${row.late} late`}</td><td className="hr-wi-muted">{row.coverage}</td><td className="hr-wi-right"><ReviewButton onClick={() => navigate("/hr/employees?tab=timesheet")} label={`Review ${row.department} attendance`} /></td></tr>) : <EmptyRow colSpan={5}>{loading ? "Loading department records…" : "Department attendance evidence unavailable."}</EmptyRow>}</tbody></table></div>
      </Panel>
      <div ref={decisionRef} tabIndex={-1} className="hr-wi-decision-region"><Panel title="Decision queue" subtitle="Key items requiring human review · Based on current data" icon="ClipboardDocumentCheckIcon">
        <div className="hr-wi-table-wrap"><table><thead><tr><th>Item</th><th>Count</th><th>Owner</th><th className="hr-wi-right">Next action</th></tr></thead><tbody>{decisionItems.map(item => <tr key={item.label}><td>{item.label}</td><td><strong>{display(item.count)}</strong></td><td>HR Team</td><td className="hr-wi-right"><ReviewButton onClick={() => navigate(item.route)} label={`Review ${item.label.toLowerCase()}`} /></td></tr>)}</tbody></table></div>
      </Panel></div>
    </div>
    {notice && !noticeDismissed && <aside className="hr-wi-notice" aria-label="HR actions requiring review"><Icon name="ExclamationTriangleIcon" /><div><strong>{display(dashboardActions)} HR actions due</strong><p>{notice.count} {notice.detail}.</p><small>{notice.source} · HR Team</small><div className="hr-wi-notice-footer"><div><button type="button" aria-label="Previous HR action" disabled={actionItems.length < 2} onClick={() => setNoticeIndex(value => (value + actionItems.length - 1) % actionItems.length)}><Icon name="ChevronLeftIcon" /></button><span>{noticeIndex % actionItems.length + 1} of {actionItems.length}</span><button type="button" aria-label="Next HR action" disabled={actionItems.length < 2} onClick={() => setNoticeIndex(value => (value + 1) % actionItems.length)}><Icon name="ChevronRightIcon" /></button></div><Button primary onClick={() => navigate(notice.route)}>Review</Button></div></div><button type="button" className="hr-wi-notice-close" aria-label="Dismiss HR reminder" onClick={() => setNoticeDismissed(true)}><Icon name="XMarkIcon" /></button></aside>}
  </div>;
}
