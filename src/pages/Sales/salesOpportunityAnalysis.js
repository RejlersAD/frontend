export const ANALYSIS_SECTIONS = [
  ["brief", "What is this opportunity?"],
  ["client_need", "What does the client want?"],
  ["submission", "What do we need to submit?"],
  ["risk", "What risks need attention?"],
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
  if (data.error_code === "ai_not_configured" || data.ai_ready === false)
    return "The Sales AI provider is not configured for analysis. Your documents are unchanged; ask an administrator to check AI configuration.";
  if (data.error_code === "no_verified_source_results") {
    const failed = data.counts?.chunks_failed || 0;
    return `${failed ? `${failed} text ${failed === 1 ? "section" : "sections"} failed AI analysis. ` : ""}No findings were verified. Review source coverage and retry incomplete sources.`;
  }
  return "AI analysis could not finish. Review source coverage and retry incomplete sources.";
}

export function analysisSectionMessage(key, data) {
  const topic = {
    brief: "opportunity overview",
    client_need: "client requirements",
    submission: "submission requirements",
    risk: "risk findings",
    action: "suggested actions",
    deadline: "deadlines",
    next_step: "next steps",
  }[key];
  if (data.counts?.partial || data.counts?.failed)
    return `No ${topic} verified from the available sources. Some sources are incomplete; review source coverage.`;
  return `No ${topic} detected in the analyzed sources. Review the tender documents or add missing files.`;
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
    data.result?.review_note || "AI suggestions require review.",
  ];
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
        `- ${item.text}${item.date ? ` (${item.date})` : ""}`,
        `  Source: ${item.name}, ${item.location}`,
        `  Evidence: ${item.excerpt}`,
      );
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
