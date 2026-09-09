/* eslint-disable react/prop-types */
import * as HeroIcons from "@heroicons/react/24/outline";

const Icon = ({ name, className = "h-4 w-4" }) => {
  const Component = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon;
  return <Component className={className} aria-hidden="true" />;
};

const number = (value) => Number(value || 0);
const percent = (value, total) =>
  total > 0
    ? Math.min(100, Math.round((number(value) / number(total)) * 100))
    : 0;

const KPI_TONES = {
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-white to-blue-50/70",
    icon: "bg-blue-100/80 text-blue-700",
    value: "text-blue-950",
  },
  violet: {
    card: "border-violet-200 bg-gradient-to-br from-white to-violet-50/70",
    icon: "bg-violet-100/80 text-violet-700",
    value: "text-violet-950",
  },
  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70",
    icon: "bg-emerald-100/80 text-emerald-700",
    value: "text-emerald-950",
  },
  rose: {
    card: "border-rose-200 bg-gradient-to-br from-white to-rose-50/80",
    icon: "bg-rose-100/80 text-rose-700",
    value: "text-rose-950",
  },
};

const employeeName = (row) =>
  row?.employee_name ||
  row?.radai_full_name ||
  row?.name ||
  [row?.first_name, row?.last_name].filter(Boolean).join(" ") ||
  row?.employee_code ||
  "Employee";

const formatDate = (value, fallback = "Date pending") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const compactDate = (date) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const downloadDashboardCsv = ({ workforce, daily, monthRollup }) => {
  const lines = [
    ["HR Command Center export"],
    ["Generated", new Date().toISOString()],
    [],
    ["Workforce"],
    ["Employee", "Department", "Status", "Email"],
    ...workforce.map((employee) => [
      employeeName(employee),
      employee.department || "",
      employee.status || "",
      employee.email || employee.user?.email || "",
    ]),
    [],
    ["Today's attendance"],
    ["Employee", "Department", "First in", "Hours", "Late", "Full day"],
    ...daily.map((row) => [
      employeeName(row),
      row.department || "",
      row.first_in_time || row.login_time || "",
      row.total_hours ?? "",
      row.is_late ? "Yes" : "No",
      row.is_full_day ? "Yes" : "No",
    ]),
    [],
    ["Month to date"],
    ["Total hours", monthRollup.totalHours],
    ["Average hours per employee", monthRollup.avgHoursPerEmployee],
    ["Full days", monthRollup.totalFull],
    ["Late arrivals", monthRollup.totalLate],
  ];
  const blob = new Blob(
    [lines.map((line) => line.map(csvCell).join(",")).join("\n")],
    {
      type: "text/csv;charset=utf-8",
    },
  );
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
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-10 items-center justify-center gap-2 rounded-[var(--app-radius-control)] border px-4 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] disabled:cursor-wait disabled:opacity-60 ${
      primary
        ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white hover:border-[var(--app-primary-hover)] hover:bg-[var(--app-primary-hover)]"
        : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-subtle)]"
    }`}
  >
    {icon && <Icon name={icon} className="h-4 w-4" />}
    {children}
  </button>
);

const MetricCard = ({
  icon,
  tone,
  label,
  value,
  detail,
  sideDetail,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-h-24 w-full gap-4 rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${KPI_TONES[tone].card}`}
  >
    <span
      className={`h-fit shrink-0 rounded-lg p-2.5 ${KPI_TONES[tone].icon}`}
    >
      <Icon name={icon} className="h-6 w-6" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <span className={`mt-1 block text-2xl font-bold leading-none tracking-tight tabular-nums ${KPI_TONES[tone].value}`}>
        {value}
      </span>
      <span className="mt-0.5 block truncate text-xs text-slate-500">
        {detail}
      </span>
    </span>
    {sideDetail && (
      <span className="ml-auto max-w-[100px] self-center text-right text-xs leading-4 text-slate-500">
        {sideDetail}
      </span>
    )}
  </button>
);

const Panel = ({ title, subtitle, icon, action, children }) => (
  <section className="overflow-hidden rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex min-h-16 items-center justify-between border-b border-slate-100 px-5 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[var(--app-primary)]">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="truncate text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Avatar = ({ row, tone = "bg-blue-100 text-blue-700" }) => (
  <span
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone}`}
  >
    {employeeName(row)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()}
  </span>
);

const EmptyRow = ({ colSpan, children }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="px-3 py-6 text-center text-sm text-slate-500"
    >
      {children}
    </td>
  </tr>
);

export default function HRCommandCenterView({
  workforce = [],
  live,
  daily,
  lifecycleRequests = [],
  pending,
  joiners = [],
  punctuality,
  monthRollup,
  totalPending,
  autoRefresh,
  setAutoRefresh,
  now,
  loading,
  workforceError,
  timesheetError,
  onRetryWorkforce,
  onRefresh,
  onOpenReport,
  navigate,
}) {
  const todayStart = new Date(now || new Date());
  todayStart.setHours(0, 0, 0, 0);
  const upcomingLimit = new Date(todayStart);
  upcomingLimit.setDate(upcomingLimit.getDate() + 14);
  const dailyRows = Array.isArray(daily?.rows) ? daily.rows : [];
  const active = workforce.filter(
    (employee) => employee.status === "active",
  ).length;
  const present = number(live?.summary?.currently_in);
  const seen = number(live?.summary?.total_seen_today) || punctuality.total;
  const scheduled = active || punctuality.total;
  const attendanceRate = percent(seen, scheduled);
  const presentRate = percent(present, active);
  const notCheckedIn = Math.max(0, scheduled - seen);
  const late = number(live?.summary?.late_today) || punctuality.late;
  const fullDayLeave = (pending?.pendingLeave || []).filter((item) =>
    ["approved", "active"].includes(String(item.status || "").toLowerCase()),
  ).length;

  const attentionRows = dailyRows
    .filter((row) => row.is_late || row.is_full_day === false)
    .sort((a, b) => Number(Boolean(b.is_late)) - Number(Boolean(a.is_late)))
    .slice(0, 4);

  const upcoming = [
    ...lifecycleRequests.map((row) => ({
      ...row,
      kind: row.request_type || "Onboarding",
      date: row.effective_date || row.joining_date || row.created_at,
      route: "/hr/onboarding",
      action: "Review",
    })),
    ...(pending?.pendingLeave || []).map((row) => ({
      ...row,
      kind: "Leave begins",
      date: row.start_date,
      route: "/hr/payroll?tab=leave",
      action: "View",
    })),
  ]
    .filter((row) => {
      if (!row.date) return false;
      const itemDate = new Date(row.date);
      return (
        !Number.isNaN(itemDate.getTime()) &&
        itemDate >= todayStart &&
        itemDate <= upcomingLimit
      );
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);

  const actionItems = [
    {
      count: lifecycleRequests.length,
      label: "onboarding cases need review",
      detail: "Onboarding · Due this week",
      icon: "UserGroupIcon",
      action: "Review",
      route: "/hr/onboarding",
    },
    {
      count: number(pending?.pendingLeaveCount),
      label: "leave records require attention",
      detail: "Leave · Upcoming and pending",
      icon: "CalendarDaysIcon",
      action: "View leave",
      route: "/hr/payroll?tab=leave",
    },
    {
      count: late,
      label: "attendance exceptions require confirmation",
      detail: "Attendance · Today",
      icon: "ExclamationCircleIcon",
      action: "Resolve",
      route: "/hr/employees?tab=timesheet",
    },
  ].filter((item) => item.count > 0);

  const recentChanges = joiners.slice(0, 5).map((employee) => ({
    ...employee,
    changeType: "Joined",
    effectiveDate: employee.created_at,
  }));

  const currentDate = compactDate(now || new Date());
  const dashboardActions = Math.max(
    totalPending,
    actionItems.reduce((sum, item) => sum + item.count, 0),
  );
  const attentionTotal =
    punctuality.onTime + late + fullDayLeave + notCheckedIn;
  const barTotal = Math.max(1, attentionTotal);

  return (
    <main className="min-h-full w-full bg-[var(--app-surface-subtle)] px-3 py-4 font-[var(--font-sans)] text-[var(--app-text)] sm:px-4">
      <div className="w-full space-y-4">
        <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-[30px] font-bold leading-tight tracking-tight text-slate-950">
              RejlersAB Employees Dashboard </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button icon="CalendarDaysIcon">Today · {currentDate}</Button>
            <button
              type="button"
              onClick={() => setAutoRefresh((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-medium text-[var(--app-text-muted)] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
            >
              <span
                className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500" : "bg-slate-400"}`}
              />
              Auto-refresh {autoRefresh ? "on" : "off"}
            </button>
            <Button icon="ArrowPathIcon" onClick={onRefresh} disabled={loading}>
              Refresh
            </Button>
            <Button
              icon="ArrowDownTrayIcon"
              onClick={() =>
                downloadDashboardCsv({
                  workforce,
                  daily: dailyRows,
                  monthRollup,
                })
              }
            >
              Export
            </Button>
            <Button
              icon="PlusIcon"
              primary
              onClick={() => navigate("/hr/onboarding?tab=create")}
            >
              Add employee
            </Button>
          </div>
        </header>

        {(workforceError || timesheetError) && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Icon name="ExclamationTriangleIcon" className="h-5 w-5 shrink-0" />
            <span className="flex-1">
              {workforceError
                ? "The workforce directory could not be loaded. Existing attendance information is shown where available."
                : "Attendance data is temporarily unavailable."}
            </span>
            {workforceError && (
              <Button onClick={onRetryWorkforce}>Retry</Button>
            )}
          </div>
        )}

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon="UserGroupIcon"
            tone="blue"
            label="Active employees"
            value={active}
            detail="Currently active workforce"
            onClick={() => onOpenReport("active")}
          />
          <MetricCard
            icon="UserIcon"
            tone="violet"
            label="Present now"
            value={present}
            detail="Currently at work"
            sideDetail={`${presentRate}% of active employees`}
            onClick={() => onOpenReport("currently_in")}
          />
          <MetricCard
            icon="ChartBarIcon"
            tone="emerald"
            label="Attendance today"
            value={`${attendanceRate}%`}
            detail={`${seen} of ${scheduled} scheduled`}
            onClick={() => onOpenReport("attendance_rate")}
          />
          <MetricCard
            icon="ClipboardDocumentCheckIcon"
            tone="rose"
            label="HR actions due"
            value={dashboardActions}
            detail="Requires your attention"
            sideDetail="Open ›"
            onClick={() => navigate("/hr/payroll")}
          />
        </section>

        <section className="grid overflow-hidden rounded-lg border border-amber-300 bg-[#fffbef] shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:grid-cols-[270px_1fr]">
          <div className="flex gap-3 border-b border-amber-200 px-4 py-3 lg:border-b-0 lg:border-r">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Icon name="ExclamationTriangleIcon" className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-amber-950">
                Action required
              </h2>
              <p className="text-sm text-amber-700">
                Items that need HR attention
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-100 bg-white/70 px-4">
            {actionItems.length === 0 ? (
              <div className="flex h-full min-h-16 items-center gap-2 text-sm font-semibold text-emerald-700">
                <Icon name="CheckCircleIcon" className="h-5 w-5" /> All HR
                actions are up to date
              </div>
            ) : (
              actionItems.map((item) => (
                <div
                  key={item.label}
                  className="grid min-h-16 items-center gap-3 py-2.5 sm:grid-cols-[1fr_150px_125px]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      name={item.icon}
                      className="h-4 w-4 shrink-0 text-amber-600"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        <strong>{item.count}</strong> {item.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    HR Team
                  </span>
                  <Button onClick={() => navigate(item.route)}>
                    {item.action}
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-2">
          <Panel
            title="Today's attendance"
            subtitle={`Status for ${scheduled} scheduled employees · ${currentDate} · Local time`}
            icon="UserGroupIcon"
          >
            <div className="p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  [
                    "CheckCircleIcon",
                    "bg-emerald-50 text-emerald-600",
                    "On time",
                    punctuality.onTime,
                    percent(punctuality.onTime, scheduled),
                  ],
                  [
                    "ClockIcon",
                    "bg-amber-50 text-amber-600",
                    "Late",
                    late,
                    percent(late, scheduled),
                  ],
                  [
                    "CalendarDaysIcon",
                    "bg-blue-50 text-blue-600",
                    "Full day leave",
                    fullDayLeave,
                    percent(fullDayLeave, scheduled),
                  ],
                ].map(([icon, tone, label, value, pct]) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${tone}`}
                    >
                      <Icon name={icon} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        {label}
                      </p>
                      <p className="text-lg font-bold leading-5 text-slate-900">
                        {value}
                      </p>
                    </div>
                    <span className="ml-auto text-xs text-slate-500">
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-slate-200">
                  <span
                    className="bg-emerald-500"
                    style={{
                      width: `${percent(punctuality.onTime, barTotal)}%`,
                    }}
                  />
                  <span
                    className="bg-amber-400"
                    style={{ width: `${percent(late, barTotal)}%` }}
                  />
                  <span
                    className="bg-blue-400"
                    style={{ width: `${percent(fullDayLeave, barTotal)}%` }}
                  />
                </div>
                <div className="w-32 text-xs text-slate-500">
                  <strong className="block text-sm text-slate-700">
                    {notCheckedIn}
                  </strong>
                  Not yet checked in
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 pt-3 text-sm font-semibold text-slate-700">
              Employees requiring attention ({attentionRows.length})
            </div>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-1.5">Name</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attentionRows.length === 0 ? (
                    <EmptyRow colSpan={5}>
                      No attendance exceptions today.
                    </EmptyRow>
                  ) : (
                    attentionRows.map((row, index) => (
                      <tr key={row.id || row.employee_code || index}>
                        <td className="py-1.5 font-medium text-slate-800">
                          {employeeName(row)}
                        </td>
                        <td>{row.department || "—"}</td>
                        <td>
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold ${row.is_late ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
                          >
                            {row.is_late ? "Late" : "Partial day"}
                          </span>
                        </td>
                        <td>{row.first_in_time || row.login_time || "—"}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate("/hr/employees?tab=timesheet")
                            }
                            className="rounded border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Upcoming HR work"
            subtitle={`Next 14 days · ${upcoming.length} items`}
            icon="CalendarDaysIcon"
          >
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2">Person</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Owner</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcoming.length === 0 ? (
                    <EmptyRow colSpan={5}>
                      No upcoming HR work in the current data.
                    </EmptyRow>
                  ) : (
                    upcoming.map((row, index) => (
                      <tr key={`${row.id || employeeName(row)}-${index}`}>
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <Avatar row={row} />{" "}
                            <span className="font-medium text-slate-800">
                              {employeeName(row)}
                            </span>
                          </span>
                        </td>
                        <td>{row.kind}</td>
                        <td>{formatDate(row.date)}</td>
                        <td>HR Team</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => navigate(row.route)}
                            className="rounded border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50"
                          >
                            {row.action}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Panel
            title="Month to date"
            subtitle={`${compactDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} – ${currentDate} · ${monthRollup.employees} employees`}
            icon="ChartBarIcon"
          >
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2">Metric</th>
                    <th>This month</th>
                    <th>Operational view</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    [
                      "Total hours",
                      monthRollup.totalHours.toLocaleString(),
                      "Recorded",
                    ],
                    [
                      "Average hours per employee",
                      monthRollup.avgHoursPerEmployee,
                      "Current average",
                    ],
                    [
                      "Full days",
                      monthRollup.totalFull.toLocaleString(),
                      "Completed",
                    ],
                    [
                      "Late arrivals",
                      monthRollup.totalLate.toLocaleString(),
                      monthRollup.totalLate > 0
                        ? "Needs attention"
                        : "On track",
                    ],
                  ].map(([metric, value, status]) => (
                    <tr key={metric}>
                      <td className="py-1.5 font-medium text-slate-700">
                        {metric}
                      </td>
                      <td className="font-semibold text-slate-900">{value}</td>
                      <td
                        className={
                          status === "Needs attention"
                            ? "font-semibold text-rose-600"
                            : "text-emerald-600"
                        }
                      >
                        {status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Recent people changes"
            subtitle={`Latest joiners and exits · ${recentChanges.length} items`}
            icon="UserGroupIcon"
            action={
              <button
                type="button"
                onClick={() => navigate("/hr/employees")}
                className="text-sm font-medium text-[var(--app-primary)] hover:underline"
              >
                View employee directory
              </button>
            }
          >
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2">Name</th>
                    <th>Department</th>
                    <th>Type</th>
                    <th>Effective date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentChanges.length === 0 ? (
                    <EmptyRow colSpan={4}>
                      No recent people changes in the current data.
                    </EmptyRow>
                  ) : (
                    recentChanges.map((row, index) => (
                      <tr key={row.id || row.employee_id || index}>
                        <td className="py-1.5 font-medium text-slate-800">
                          {employeeName(row)}
                        </td>
                        <td>{row.department || "—"}</td>
                        <td>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
                            {row.changeType}
                          </span>
                        </td>
                        <td>{formatDate(row.effectiveDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
