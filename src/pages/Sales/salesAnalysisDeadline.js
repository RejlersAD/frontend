const months = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const two = (value) => String(value).padStart(2, "0");
const dateKey = (value) => {
  const text = String(value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4})/.exec(text);
  const month = named && months[named[2].slice(0, 3).toLowerCase()];
  return month ? `${named[3]}-${two(month)}-${two(named[1])}` : "";
};
const sourceDateMatches = (value, key) => {
  if (dateKey(value) === key) return true;
  const numeric = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (!numeric) return false;
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  return key === `${numeric[3]}-${two(first)}-${two(second)}` ||
    key === `${numeric[3]}-${two(second)}-${two(first)}`;
};
const displayDate = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  return `${Number(match[3])} ${Object.keys(months)[Number(match[2]) - 1].replace(/^./, (c) => c.toUpperCase())} ${match[1]}`;
};
const clock = (hour, minute) => `${((hour + 11) % 12) + 1}:${two(minute)} ${hour < 12 ? "AM" : "PM"}`;

export function analysisDueDateTime(record, summary) {
  const date = dateKey(summary?.submission_date) || dateKey(record?.submission_due_date);
  if (!date) return "Submission date and time not established";
  const label = displayDate(date);
  for (const row of Array.isArray(summary?.project_facts?.submission_details)
    ? summary.project_facts.submission_details : []) {
    const value = String(row?.value || row?.finding || "");
    if (row?.relative_date === date) {
      const relative = /\bsubmission\s+is\s+at\s+(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)\s+today\b/i.exec(value);
      if (relative && Number(relative[1]) >= 1 && Number(relative[1]) <= 12) {
        const hour = (Number(relative[1]) % 12) + (relative[3].toUpperCase() === "PM" ? 12 : 0);
        return `${label} · ${clock(hour, Number(relative[2]))} (time zone not stated)`;
      }
    }
    const dated = value.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{1,2}[\s-]+[A-Za-z]{3,9}[\s,-]+\d{4}/);
    if (!dated || !sourceDateMatches(dated[0], date)) continue;
    const near = value.slice(dated.index + dated[0].length, dated.index + dated[0].length + 35);
    const match = /^\s*(?:at\s+)?(?:by\s+)?(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)?\b/i.exec(near);
    if (!match) continue;
    const hour = Number(match[1]);
    if (hour > 23 || (match[3] && (hour < 1 || hour > 12))) continue;
    const normalized = match[3] ? (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0) : hour;
    const zone = /\b(?:GST|UAE|UTC|GMT|Gulf Standard Time)\b/i.exec(near)?.[0];
    return `${label} · ${clock(normalized, Number(match[2]))}${zone ? ` ${zone}` : " (time zone not stated)"}`;
  }
  const saved = record?.qualification_data?.submission_deadline_at || record?.custom_fields?.submission_deadline_at;
  if (typeof saved === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(saved)) {
    const parsed = new Date(saved);
    if (/Z$|[+-]\d{2}:\d{2}$/.test(saved) && !Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(parsed);
      const part = (type) => parts.find((item) => item.type === type)?.value;
      if (`${part("year")}-${part("month")}-${part("day")}` === date)
        return `${label} · ${clock(Number(part("hour")), Number(part("minute")))} GST`;
    } else if (dateKey(saved) === date) {
      return `${label} · ${clock(Number(saved.slice(11, 13)), Number(saved.slice(14, 16)))} (time zone not stated)`;
    }
  }
  return `${label} · time not stated`;
}
