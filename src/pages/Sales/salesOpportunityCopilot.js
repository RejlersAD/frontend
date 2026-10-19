/**
 * salesOpportunityCopilot.js — Copilot intelligence from analysis + record.
 * Pure functions, no network. Traceability: Analysis Copilot upgrade.
 */

const num = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sectionCount = (data, key) => {
  const list = data?.result?.sections?.[key];
  return Array.isArray(list) ? list.length : 0;
};

const daysTo = (value, today = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dubai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(today)
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const diff =
    Date.parse(`${value}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(diff) ? Math.round(diff / 86400000) : null;
};

/** Qualification score 0-100: evidence 45, commercial 20, timing 15, risks 10, sources 10. */
export function copilotScore(record = {}, data = null) {
  const counts = data?.counts || {};
  const ready = num(counts.ready) ?? 0;
  const total = num(counts.total) ?? 0;
  const coverage = total > 0 ? Math.min(1, ready / total) : 0;
  const brief = sectionCount(data, "brief") > 0 ? 1 : 0;
  const needs = Math.min(1, sectionCount(data, "client_need") / 3);
  const subs = Math.min(1, sectionCount(data, "submission") / 3);
  const evidence = Math.round(
    (coverage * 0.5 + brief * 0.15 + needs * 0.2 + subs * 0.15) * 45,
  );
  const winProb = num(record.win_probability);
  const hasValue = num(record.estimated_value) !== null;
  const commercial = Math.round(
    ((winProb !== null ? winProb / 100 : 0.4) * 0.6 + (hasValue ? 0.4 : 0.1)) *
      20,
  );
  const dueDays = daysTo(record.submission_due_date);
  const timing =
    dueDays === null
      ? 9
      : dueDays < 0
        ? 2
        : dueDays <= 3
          ? 5
          : dueDays <= 14
            ? 11
            : 15;
  const risks = sectionCount(data, "risk");
  const riskPts = risks === 0 ? 10 : risks <= 2 ? 7 : risks <= 4 ? 4 : 2;
  const sourcePts = total === 0 ? 0 : ready >= 3 ? 10 : ready >= 1 ? 6 : 3;
  const score = Math.max(
    0,
    Math.min(100, evidence + commercial + timing + riskPts + sourcePts),
  );
  const band =
    score >= 75
      ? "strong"
      : score >= 50
        ? "moderate"
        : score >= 30
          ? "weak"
          : "critical";
  return {
    score,
    band,
    coverage: Math.round(coverage * 100),
    dueDays,
    risks,
    ready,
    total,
  };
}

/** AI confidence from source readiness + verification depth. */
export function copilotConfidence(data = null) {
  const counts = data?.counts || {};
  const ready = num(counts.ready) ?? 0;
  const partial = num(counts.partial) ?? 0;
  const failed = num(counts.failed) ?? 0;
  const total = num(counts.total) ?? 0;
  const status = data?.status;
  if (status === "ready" && ready > 0 && failed === 0) {
    return {
      level: "high",
      label: "High confidence",
      detail: `${ready} verified source${ready === 1 ? "" : "s"}`,
    };
  }
  if (status === "partial" || (ready > 0 && (partial > 0 || failed > 0))) {
    return {
      level: "medium",
      label: "Medium confidence",
      detail: `${ready} verified · ${partial + failed} need review`,
    };
  }
  if (total > 0) {
    return {
      level: "low",
      label: "Low confidence",
      detail: "No verified findings yet",
    };
  }
  return { level: "none", label: "No data", detail: "Attach tender documents" };
}

/** Next-best-actions with deep links. priority: now | soon | later. */
export function copilotActions(record = {}, data = null) {
  const actions = [];
  const counts = data?.counts || {};
  const total = num(counts.total) ?? 0;
  const status = data?.status;
  const score = copilotScore(record, data);
  if (total === 0) {
    actions.push({
      id: "attach",
      title: "Attach tender documents",
      detail:
        "No sources inventoried. Upload the RFQ, scope and addenda to unlock the brief.",
      view: "Sources",
      priority: "now",
    });
    return actions;
  }
  if (status === "failed" || status === "blocked") {
    actions.push({
      id: "retry",
      title: "Retry incomplete sources",
      detail:
        "Analysis could not verify documents. Retry to rebuild the brief.",
      view: "Sources",
      priority: "now",
    });
  }
  if (score.dueDays !== null && score.dueDays <= 7 && score.dueDays >= 0) {
    actions.push({
      id: "deadline",
      title: `Submission due in ${score.dueDays} day${score.dueDays === 1 ? "" : "s"}`,
      detail: "Review Timeline milestones, then lock the Go/No-Go date.",
      view: "Timeline",
      priority: "now",
    });
  }
  if (score.risks > 0) {
    actions.push({
      id: "risks",
      title: `Review ${score.risks} flagged risk${score.risks === 1 ? "" : "s"}`,
      detail:
        "Risks shape the Go/No-Go justification. Clear or mitigate them first.",
      view: "Risks",
      priority: score.risks > 2 ? "now" : "soon",
    });
  }
  if (sectionCount(data, "submission") > 0) {
    actions.push({
      id: "subs",
      title: "Confirm submission checklist",
      detail: `${sectionCount(data, "submission")} deliverable requirement${sectionCount(data, "submission") === 1 ? "" : "s"} verified. Confirm owners.`,
      view: "Submissions",
      priority: "soon",
    });
  }
  if (sectionCount(data, "action") > 0 || sectionCount(data, "next_step") > 0) {
    actions.push({
      id: "next",
      title: "Work the suggested next steps",
      detail:
        "Copilot extracted pending actions from the documents. Assign and date them.",
      view: "Actions",
      priority: "soon",
    });
  }
  if (score.band === "strong" || score.band === "moderate") {
    actions.push({
      id: "decide",
      title: "Record the Go decision",
      detail: `Qualification score ${score.score}/100 (${score.band}). The decision dialog drafts an intelligence-grounded justification.`,
      view: null,
      priority: "later",
      decision: true,
    });
  } else {
    actions.push({
      id: "qualify",
      title: "Strengthen qualification first",
      detail: `Qualification score ${score.score}/100 (${score.band}). Close evidence gaps before committing pursuit cost.`,
      view: "Brief",
      priority: "later",
    });
  }
  const order = { now: 0, soon: 1, later: 2 };
  return actions.sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Risk severity heuristic for display triage. */
export function riskSeverity(text = "") {
  const t = String(text).toLowerCase();
  if (
    /(penalt|liquidated|terminat|disqualif|non-compliant|fail|critical|exclud)/.test(
      t,
    )
  )
    return "high";
  if (
    /(risk|delay|unclear|ambigu|missing|constraint|limit|tight|short)/.test(t)
  )
    return "medium";
  return "low";
}

export const SCORE_RING = { size: 120, stroke: 11, radius: 48 };
export const scoreColor = (band) =>
  band === "strong"
    ? "#10b981"
    : band === "moderate"
      ? "#3b82f6"
      : band === "weak"
        ? "#f59e0b"
        : "#ef4444";
