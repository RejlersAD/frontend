// Read-only projections of the existing attendance responses. These do not
// establish shift schedules, capacity, approved leave or attendance targets.
const identity = (row) => {
  for (const key of ['employee_code', 'employee_number', 'radai_user_id', 'user_id', 'email']) {
    const value = String(row?.[key] ?? '').trim().toLowerCase();
    if (value) return `${key}:${value}`;
  }
  return null;
};

const distinctRows = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = identity(row);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const explicitCount = (rows, field, expected) => rows.every((row) => typeof row[field] === 'boolean')
  ? rows.filter((row) => row[field] === expected).length : null;

export const attendanceAvailability = (response) => {
  if (!response) return { available: false, reason: 'Attendance records have not been loaded.' };
  if (response.configured === false) return {
    available: false,
    reason: response.reason ? 'The attendance source is unavailable.' : 'The attendance source is not configured.',
  };
  if (response.error || response.available === false || !Array.isArray(response.rows) ||
      response.rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    return { available: false, reason: 'Attendance records are unavailable.' };
  }
  return { available: true, reason: null };
};

export const buildDailyObservation = (response) => {
  const availability = attendanceAvailability(response);
  if (!availability.available) return { ...availability, present: null, late: null, onTime: null, partial: null, rows: [] };
  const rows = distinctRows(response.rows);
  return {
    ...availability, rows, present: rows.length,
    late: explicitCount(rows, 'is_late', true),
    onTime: explicitCount(rows, 'is_late', false),
    partial: explicitCount(rows, 'is_full_day', false),
  };
};

export const buildAttendancePattern = (monthly, today = new Date(), days = 7) => {
  const end = today instanceof Date ? new Date(today) : new Date(today);
  if (Number.isNaN(end.getTime())) return [];
  end.setHours(12, 0, 0, 0);
  const length = Math.min(30, Math.max(1, Number.isFinite(Number(days)) ? Math.floor(Number(days)) : 7));
  const availability = attendanceAvailability(monthly);
  const observations = new Map();
  if (availability.available) {
    monthly.rows.forEach((row) => {
      const employee = identity(row);
      if (!employee || !Array.isArray(row.days_detail)) return;
      row.days_detail.forEach((detail) => {
        if (!detail || typeof detail !== 'object' || !detail.first_in) return;
        const date = String(detail.date || '').slice(0, 10);
        // A recorded timestamp/time proves a check-in; arbitrary nonempty text does not.
        const firstIn = String(detail.first_in);
        const timeOnly = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(firstIn);
        const timestamp = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(firstIn) && !Number.isNaN(Date.parse(firstIn));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (!timeOnly && !timestamp)) return;
        if (!observations.has(date)) observations.set(date, new Map());
        const employees = observations.get(date);
        if (!employees.has(employee)) employees.set(employee, detail);
      });
    });
  }
  return Array.from({ length }, (_, index) => {
    const day = new Date(end);
    day.setDate(day.getDate() - (length - index - 1));
    const date = dateKey(day);
    const rows = [...(observations.get(date)?.values() || [])];
    const available = availability.available && rows.length > 0;
    return {
      date, available,
      present: available ? rows.length : null,
      onTime: available ? explicitCount(rows, 'is_late', false) : null,
      late: available ? explicitCount(rows, 'is_late', true) : null,
      scheduled: null, rate: null,
      reason: available ? null : availability.reason || 'No recorded check-in evidence for this date.',
    };
  });
};

const departmentName = (row) => String(row.radai_department || row.department || '').trim() || 'Department not recorded';
const liveState = (row) => {
  if (typeof row.is_in === 'boolean') return row.is_in;
  if (row.is_in !== undefined) return null;
  const punch = String(row.punch_type ?? '').toUpperCase();
  if (['IN', '1'].includes(punch)) return true;
  if (['OUT', '0', '2'].includes(punch)) return false;
  return null;
};

export const buildDepartmentReadiness = (daily, live) => {
  const observation = buildDailyObservation(daily);
  const liveAvailability = attendanceAvailability(live);
  const liveRows = liveAvailability.available ? distinctRows(live.rows) : [];
  const departments = [...new Set([...observation.rows, ...liveRows].map(departmentName))];
  return departments.map((department) => {
    const dailyRows = observation.rows.filter((row) => departmentName(row) === department);
    const currentRows = liveRows.filter((row) => departmentName(row) === department);
    const liveStates = currentRows.map(liveState);
    return {
      department,
      observed: observation.available && dailyRows.length > 0 ? dailyRows.length : null,
      late: observation.available && dailyRows.length > 0 ? explicitCount(dailyRows, 'is_late', true) : null,
      present: liveAvailability.available && liveStates.length > 0 && liveStates.every((state) => state !== null)
        ? liveStates.filter(Boolean).length : null,
      coverage: 'Attendance records only',
    };
  }).sort((a, b) => a.department.localeCompare(b.department));
};
