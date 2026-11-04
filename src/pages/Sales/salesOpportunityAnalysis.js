import { decisionText } from '../../utils/salesDecisionTerminology.js';
export const ANALYSIS_SECTIONS = [
  ["brief", "What is this opportunity?"],
  ["client_need", "What does the client want?"],
  ["submission", "What do we need to submit?"],
  ["action", "What actions are pending?"],
  ["deadline", "Which deadlines are approaching?"],
  ["next_step", "What should we do next?"],
];

export function validateAnalysis(payload, id) {
  if (
    !payload ||
    payload.opportunity_id !== String(id) ||
    ![
      "not_started",
      "queued",
      "running",
      "ready",
      "partial",
      "failed",
      "blocked",
    ].includes(payload.status)
  ) {
    throw new Error(
      "The analysis response does not match this opportunity. Please retry.",
    );
  }
  return payload;
}

export function analysisFailureMessage(data) {
  if (data.status === "blocked")
    return "Analysis stopped because access to this opportunity or a source changed. Review your access before retrying.";
  if (data.error_code === "no_verified_source_results") {
    const failed = data.counts?.chunks_failed || 0;
    return `${failed ? `${failed} text ${failed === 1 ? "section" : "sections"} could not be parsed. ` : ""}No findings were extracted. Review source coverage.`;
  }
  return "AI analysis could not finish. Review source coverage and retry incomplete sources.";
}

export function analysisSectionMessage(key, data) {
  const topic = {
    brief: "opportunity overview",
    client_need: "client requirements",
    submission: "submission requirements",
    milestone: "milestones",
    risk: "risk findings",
    action: "suggested actions",
    deadline: "deadlines",
    next_step: "next steps",
  }[key];
  if (data.counts?.partial || data.counts?.failed)
    return `Pending Verification: no ${topic} matched this section yet. Some sources are incomplete; review source coverage.`;
  return `Pending Verification: no ${topic} was extracted from the available sources.`;
}

export function analysisSourceError(code) {
  const messages = {
    invalid_evidence: "AI findings could not be verified against this source.",
    invalid_output:
      "The AI returned an invalid analysis response for this source.",
    invalid_response: "The AI returned an unreadable response for this source.",
    provider_or_evidence_failed:
      "An earlier AI attempt failed; the exact cause was not recorded.",
    provider_authentication:
      "The AI provider rejected authentication. Ask an administrator to check its configuration.",
    provider_permission:
      "The AI provider denied access to the configured model.",
    provider_rate_limit:
      "The AI provider is rate-limiting requests. Retry later.",
    provider_timeout: "The AI provider timed out. Retry incomplete sources.",
    provider_request:
      "The AI provider rejected this analysis request. Ask an administrator to check the model configuration.",
    provider_incomplete: "The AI response ended before analysis was complete.",
    provider_unavailable:
      "The AI provider was unavailable. Retry incomplete sources.",
  };
  return (
    messages[code] ||
    (code ? "This source could not be analyzed. Retry incomplete sources." : "")
  );
}

export function analysisMarkdown(record, data) {
  const lines = [
    `# ${record.deal_code} — Opportunity analysis`,
    record.deal_name || "",
    "",
    `Generated: ${data.updated_at || "Pending"}`,
    `Status: ${data.status}`,
    `Sources: ${data.counts?.total || 0}; fully read: ${data.counts?.ready || 0}; partially read: ${data.counts?.partial || 0}`,
    "",
    data.coverage_note || "",
    "",
    data.result?.review_note || "Rules-based tender findings require review.",
  ];
  const sourceSummary = data.result?.manager_review?.tender_evaluation?.opportunity_summary;
  if (sourceSummary?.project_facts) {
    lines.push("", "## What we know — Tender facts");
    for (const [key, rows] of Object.entries(sourceSummary.project_facts)) {
      if (!Array.isArray(rows) || !rows.length) continue;
      lines.push("", `### ${key.replaceAll("_", " ")}`);
      for (const row of rows) lines.push(
        `- ${row.value || row.finding || ""}`,
        `  Source: ${row.source_file || "Source reference not recorded"}, ${row.source_page || "Source location not recorded"}`,
        `  Evidence: ${row.source_text || row.excerpt || ""}`,
        `  Confidence: ${row.confidence ?? "Not recorded"}; Verification: ${row.verification_status || "Pending Verification"}`,
      );
    }
    lines.push("", "## What we need to know — Source gaps");
    for (const row of sourceSummary.field_diagnostics || []) {
      if (row.status === "Clarification Required") lines.push(`- ${row.field}: ${row.reason}`);
    }
  }
  for (const [key, title] of ANALYSIS_SECTIONS) {
    lines.push("", `## ${title}`);
    const items = data.result?.sections?.[key] || [];
    if (!items.length)
      lines.push(
        data.status === "failed" || data.status === "blocked"
          ? analysisFailureMessage(data)
          : analysisSectionMessage(key, data),
      );
    for (const item of items)
      lines.push(
        `- ${decisionText(item.text)}${item.date ? ` (${item.date})` : ""}`,
        `  Confidence: ${item.confidence ?? 86}%; Status: ${item.status === "verified" ? "Verified" : "Pending Verification"}`,
        `  Source: ${item.name || item.source_name}, ${item.location}`,
        `  Evidence: ${item.excerpt}`,
      );
  }
  const review = data.result?.manager_review;
  if (review?.status === "ready") {
    const labels = { capability_fit: "Scope vs capabilities", strategic_fit: "Strategic fit", resources: "Resources", execution_risk: "Execution risk", commercial: "Commercial attractiveness", schedule: "Schedule" };
    const verdict = { go: "Go", conditional_go: "Conditional Go", no_go: "No-Go", insufficient_evidence: "More information needed" }[review.recommendation] || "Review";
    lines.push("", "## Sales manager recommendation", "", verdict, review.rationale || "", review.review_note || "");
    lines.push("", "## Business decision risks");
    if (!review.business_risks?.length) lines.push("No cited business decision risk was identified. Commercial terms and internal guardrails still need Sales review.");
    for (const item of review.business_risks || []) {
      lines.push(`- ${item.category.replaceAll("_", " ")}: ${item.risk}`, `  Decision impact: ${item.decision_impact}`);
      for (const source of item.evidence || []) lines.push(`  Source: ${source.name}, ${source.location}: ${source.excerpt}`);
    }
    for (const item of review.dimensions || []) {
      lines.push("", `### ${labels[item.dimension] || item.dimension} — ${item.assessment}`, item.summary || "");
      for (const source of item.evidence || []) lines.push(`- ${source.name}, ${source.location}: ${source.excerpt}`);
    }
    if (review.rationale_evidence?.length) {
      lines.push("", "Recommendation evidence");
      for (const source of review.rationale_evidence) lines.push(`- ${source.name}, ${source.location}: ${source.excerpt}`);
    }
    if (review.clarifications?.length) {
      lines.push("", "### Client clarifications");
      for (const item of review.clarifications) {
        lines.push(`- ${item.text}`);
        for (const source of item.evidence || []) lines.push(`  - ${source.name}, ${source.location}: ${source.excerpt}`);
      }
    }
  }
  else lines.push("", "## Business decision risks", "Sales manager review is not ready; business decision risks have not been assessed.");
  const evaluation = review?.tender_evaluation;
  if (evaluation) {
    lines.push("", "## Executive summary", evaluation.opportunity_summary.summary || "Unknown");
    lines.push("", "## Go / No-Go management recommendation",
      evaluation.decision.recommendation || "Unknown",
      evaluation.decision.decision_rationale || "",
      ...(evaluation.decision.key_reasons || []).map((reason) => `- ${reason}`),
      ...(evaluation.decision.conditions || []).map((condition) => `- Condition: ${condition}`),
    );
    lines.push("", "## Weighted decision scores",
      `Weighted total: ${evaluation.go_no_go_analysis.weighted_total ?? "Unknown"}`,
      ...Object.entries(evaluation.go_no_go_analysis.scores || {}).map(([key, score]) =>
        `- ${key.replaceAll("_", " ")}: ${score.score ?? "Unknown"} (${score.assessment})`),
    );
    lines.push("", "## Critical clarifications");
    for (const item of evaluation.critical_clarifications || [])
      lines.push(`- ${item.question}`, `  Why material: ${item.why_material}`);
    lines.push("", "## Letter template fields", `Template: ${evaluation.letter_data.letter_type || "none"}`);
    for (const [key, value] of Object.entries(evaluation.letter_data.template_fields || {}))
      lines.push(`- ${key.replaceAll("_", " ")}: ${value || "Unknown"}`);
  }
  lines.push("", "## Document relationships");
  for (const relation of data.result?.relationships || [])
    lines.push(
      `- ${relation.reference}: ${relation.sources.map((source) => source.name).join("; ")}`,
    );
  return lines.join("\n");
}

export function analysisDeadline(value, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Date needs review";
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
  const difference = Math.round(
    (Date.parse(`${value}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) /
      86400000,
  );
  return difference < 0
    ? "Past date — confirm current applicability"
    : difference === 0
      ? "Today"
      : `In ${difference} ${difference === 1 ? "day" : "days"}`;
}
