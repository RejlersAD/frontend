/* eslint-disable react/prop-types */
import * as HeroIcons from "@heroicons/react/24/outline";
import { useState } from "react";

const Icon = ({ name, className = "h-4 w-4" }) => {
  const Component = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon;
  return <Component className={className} aria-hidden="true" />;
};

const number = (value) => Number(value || 0);
const percent = (value, total) =>
  total > 0
    ? Math.min(100, Math.round((number(value) / number(total)) * 100))
    : 0;

const normalizeIdentity = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const scoreOutOf100 = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed <= 5 ? parsed * 20 : parsed));
};

const reviewPriority = {
  calibration: 2,
  manager: 2,
  peer: 2,
  direct_report: 2,
  self: 1,
};

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

const formatTime = (value) => {
  if (!value) return "—";
  const timeOnly = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (timeOnly) return `${timeOnly[1].padStart(2, "0")}:${timeOnly[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const dayKey = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const weekNumber = (value) => {
  const date = new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

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
      row.first_in || row.punch_time || row.login_time || "",
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
  monthly,
  performanceReviews = [],
  lifecycleRequests = [],
  pending,
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
  const [monthOffset, setMonthOffset] = useState(0);
  const todayStart = new Date(now || new Date());
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth() + monthOffset,
    1,
  );
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(
    calendarStart.getDate() - ((calendarStart.getDay() + 6) % 7),
  );
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  );
  const calendarCellCount =
    Math.ceil(
      (((monthStart.getDay() + 6) % 7) + monthEnd.getDate()) / 7,
    ) * 7;
  const calendarDays = Array.from({ length: calendarCellCount }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const calendarWeeks = Array.from(
    { length: calendarCellCount / 7 },
    (_, index) => calendarDays.slice(index * 7, index * 7 + 7),
  );
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

  const onboardingRequests = lifecycleRequests.filter(
    (row) => String(row.request_type).toLowerCase() === "onboarding",
  );
  const offboardingRequests = lifecycleRequests.filter(
    (row) => String(row.request_type).toLowerCase() === "offboarding",
  );
  const calendarItems = [
    ...lifecycleRequests.map((row) => ({
      ...row,
      kind: row.request_type || "Onboarding",
      date: row.effective_date || row.joining_date || row.created_at,
      route:
        String(row.request_type).toLowerCase() === "offboarding"
          ? `/hr/onboarding?tab=offboarding&record_id=${row.request_id}`
          : `/hr/onboarding?tab=onboarding&user_id=${row.user_id}&record_id=${row.request_id}`,
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
    .filter((row) => row.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const actionItems = [
    {
      count: onboardingRequests.length,
      label: "active onboarding cases need review",
      detail: "Onboarding · Active cases",
      icon: "UserGroupIcon",
      action: "Review",
      route: "/hr/onboarding",
    },
    {
      count: offboardingRequests.length,
      label: "offboarding cases need review",
      detail: "Offboarding · Due this week",
      icon: "UserMinusIcon",
      action: "Review",
      route: "/hr/onboarding?tab=offboarding",
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

  const recentChanges = workforce
    .flatMap((employee) => [
      employee.join_date && {
        ...employee,
        changeType: "Joined",
        effectiveDate: employee.join_date,
      },
      employee.exit_date && {
        ...employee,
        changeType: "Exited",
        effectiveDate: employee.exit_date,
      },
    ])
    .filter(Boolean)
    .filter((row) => dayKey(row.effectiveDate) <= dayKey(todayStart))
    .sort((a, b) => dayKey(b.effectiveDate).localeCompare(dayKey(a.effectiveDate)))
    .slice(0, 5);

  const monthlyRows = Array.isArray(monthly?.rows) ? monthly.rows : [];
  const maximumDaysPresent = Math.max(
    1,
    ...monthlyRows.map((row) => number(row.days_present)),
  );
  const attendanceByIdentity = new Map();
  monthlyRows.forEach((row) => {
    [row.employee_code, row.email].forEach((identity) => {
      const key = normalizeIdentity(identity);
      if (key) attendanceByIdentity.set(key, row);
    });
  });
  const reviewByEmployee = new Map();
  performanceReviews.forEach((review) => {
    if (scoreOutOf100(review.overall_score) === null) return;
    const key = normalizeIdentity(review.employee);
    if (!key) return;
    const current = reviewByEmployee.get(key);
    const priority = reviewPriority[review.review_type] || 0;
    const currentPriority = reviewPriority[current?.review_type] || 0;
    const reviewDate = new Date(
      review.submitted_at || review.updated_at || review.created_at || 0,
    ).getTime();
    const currentDateValue = new Date(
      current?.submitted_at || current?.updated_at || current?.created_at || 0,
    ).getTime();
    if (
      !current ||
      priority > currentPriority ||
      (priority === currentPriority && reviewDate > currentDateValue)
    ) {
      reviewByEmployee.set(key, review);
    }
  });
  const employeesOfMonth = workforce
    .map((employee) => {
      const review = reviewByEmployee.get(normalizeIdentity(employee.id));
      const attendance = [
        employee.employee_number,
        employee.employee_code,
        employee.emp_code,
        employee.email,
      ]
        .map((identity) =>
          attendanceByIdentity.get(normalizeIdentity(identity)),
        )
        .find(Boolean);
      if (!review || !attendance) return null;
      const performanceScore = scoreOutOf100(review.overall_score);
      const commitmentScore = scoreOutOf100(
        review.ratings?.job_commitment ??
          review.ratings?.jobCommitment ??
          review.ratings?.commitment ??
          review.competency_score,
      );
      if (performanceScore === null || commitmentScore === null) return null;
      const daysPresent = number(attendance.days_present);
      if (daysPresent <= 0) return null;
      const attendanceScore = Math.max(
        0,
        Math.min(
          100,
          (daysPresent / maximumDaysPresent) * 50 +
            ((daysPresent - number(attendance.late_arrivals)) / daysPresent) *
              30 +
            (number(attendance.full_days) / daysPresent) * 20,
        ),
      );
      return {
        ...employee,
        performanceScore,
        attendanceScore,
        commitmentScore,
        overallScore:
          performanceScore * 0.5 +
          attendanceScore * 0.3 +
          commitmentScore * 0.2,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5);

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
                        <td>
                          {formatTime(
                            row.first_in || row.punch_time || row.login_time,
                          )}
                        </td>
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
            title="HR calendar"
            subtitle="Onboarding, offboarding and leave"
            icon="CalendarDaysIcon"
          >
            <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-3">
              <div className="mb-2 grid grid-cols-[36px_1fr_36px] items-center">
                <button
                  type="button"
                  onClick={() => setMonthOffset((value) => value - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="Previous month"
                >
                  <Icon name="ChevronLeftIcon" />
                </button>
                <h3 className="text-center text-lg font-semibold text-slate-800">
                  {monthStart.toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <button
                  type="button"
                  onClick={() => setMonthOffset((value) => value + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="Next month"
                >
                  <Icon name="ChevronRightIcon" />
                </button>
              </div>

              <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-slate-200 text-center text-xs font-semibold text-slate-600">
                <div className="py-2">Week</div>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                  (day, index) => (
                    <div
                      key={day}
                      className={`py-2 ${index >= 5 ? "text-rose-600" : ""}`}
                    >
                      {day}
                    </div>
                  ),
                )}
              </div>

              <div className="text-xs">
                {calendarWeeks.map((week) => (
                  <div
                    key={dayKey(week[0])}
                    className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-slate-100 last:border-b-0"
                  >
                    <div className="flex h-10 items-center justify-center border-r border-slate-200 font-semibold text-slate-500">
                      {weekNumber(week[0])}
                    </div>
                    {week.map((date, index) => {
                      const isToday = dayKey(date) === dayKey(todayStart);
                      const isCurrentMonth =
                        date.getMonth() === monthStart.getMonth();
                      const items = calendarItems.filter(
                        (row) => dayKey(row.date) === dayKey(date),
                      );
                      const isOffDay = index >= 5;
                      const itemTitle = items
                        .map((row) => `${row.kind}: ${employeeName(row)}`)
                        .join("\n");
                      return (
                        <button
                          type="button"
                          key={dayKey(date)}
                          onClick={() => items[0] && navigate(items[0].route)}
                          disabled={items.length === 0}
                          title={itemTitle || undefined}
                          className={`relative flex h-10 items-center justify-center disabled:cursor-default ${isOffDay ? "bg-rose-50/60" : "hover:bg-slate-50"}`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${isToday ? "border border-slate-700 bg-white font-bold text-slate-900 shadow-sm" : isOffDay ? "text-rose-600" : isCurrentMonth ? "text-slate-800" : "text-slate-400"}`}
                          >
                            {date.getDate()}
                          </span>
                          {items.length > 0 && (
                            <span className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Panel
            title="Employees of the Month"
            subtitle="50% performance · 30% attendance · 20% job commitment"
            icon="TrophyIcon"
          >
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="w-12 py-2 text-center">Rank</th>
                    <th>Employee</th>
                    <th className="text-center">Performance</th>
                    <th className="text-center">Attendance</th>
                    <th className="text-center">Job commitment</th>
                    <th className="text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeesOfMonth.length === 0 ? (
                    <EmptyRow colSpan={6}>
                      No eligible ranking yet. Employees need both a submitted
                      performance review and current-month attendance records.
                    </EmptyRow>
                  ) : (
                    employeesOfMonth.map((employee, index) => (
                      <tr key={employee.id || employee.employee_number}>
                        <td className="py-2 text-center">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-bold ${index === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td>
                          <span className="block font-semibold text-slate-900">
                            {employeeName(employee)}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {employee.department || "Department not recorded"}
                          </span>
                        </td>
                        <td className="text-center tabular-nums">
                          {Math.round(employee.performanceScore)}%
                        </td>
                        <td className="text-center tabular-nums">
                          {Math.round(employee.attendanceScore)}%
                        </td>
                        <td className="text-center tabular-nums">
                          {Math.round(employee.commitmentScore)}%
                        </td>
                        <td className="text-right font-bold tabular-nums text-indigo-700">
                          {employee.overallScore.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Recent people changes"
            subtitle={`Employment dates from the employee directory · ${recentChanges.length} items`}
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
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold ${row.changeType === "Joined" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                          >
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
