import { analysisDueDateTime } from "./salesAnalysisDeadline.js";

const asList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const values = (rows) =>
  asList(rows)
    .map((row) => (typeof row === "string" ? row : row?.value || row?.finding))
    .filter(Boolean);
const present = (value) =>
  value &&
  !/^(unknown|not provided|not available|further client clarification required)$/i.test(
    String(value).trim(),
  );
const distinct = (items) => [...new Set(items.filter(Boolean))];

export function buildAnalysisContent(record, evaluation) {
  const summary = evaluation.opportunity_summary || {};
  const facts = summary.project_facts || {};
  const source = Object.values(facts).flatMap(values).join(" ");
  const lower = source.toLowerCase();
  const has = (pattern) => pattern.test(lower);
  const client = present(summary.client_name)
    ? summary.client_name
    : record.client_name || "Client to confirm";
  const clientDetail = present(summary.client_name) && present(record.client_name) &&
    summary.client_name !== record.client_name
    ? `${client} (Saved CRM client differs from tender: ${record.client_name}; verify identity)`
    : client;
  const project = present(summary.project_name)
    ? summary.project_name
    : record.deal_name || "Opportunity title to confirm";
  const scope = distinct([
    has(/\b(?:erp|sap|oneerp|s\/4hana)\b/) && "ERP implementation",
    has(/\b(?:gbs|global business services|operating model)\b/) &&
      "GBS operating model",
    has(/\binfrastructure\b/) && "infrastructure",
    has(/\bcyber(?:security| security)\b/) && "cybersecurity",
  ]);
  const workstreams = scope.length
    ? scope.join(", ")
    : values(facts.scope)[0]?.slice(0, 180) || "Scope requires tender review";
  const locations = distinct(
    ["Abu Dhabi", "Dubai", "London", "Singapore", "Mumbai"].filter((name) =>
      lower.includes(name.toLowerCase()),
    ),
  );
  const systems = distinct(
    ["IMOS", "AMOS", "EyeShare", "OneERP", "SAP"].filter((name) =>
      lower.includes(name.toLowerCase()),
    ),
  );
  const milestones = distinct(
    values(facts.timeline).flatMap((text) =>
      [
        ...text.matchAll(
          /\b(?:Q[1-4]\s+20\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}|20\d{2}-\d{2}-\d{2})\b/gi,
        ),
      ].map((match) => match[0]),
    ),
  ).slice(0, 4);
  const commercialModel = present(
    evaluation.commercial_attractiveness?.contract_model,
  )
    ? evaluation.commercial_attractiveness.contract_model
    : values(facts.commercial_model)[0];
  const paymentTerms = values(facts.payment_terms)[0];
  const commercialFramework = distinct([
    commercialModel,
    has(/\bfixed[ -]?price\b/) && "Fixed Price allocation referenced in tender",
    has(/\b(?:t\s*&\s*m|time and materials|rate card)\b/) &&
      "T&M rate card referenced in tender",
    paymentTerms,
  ]);
  const entityDetail = has(/\bsubsidiar(?:y|ies)\b/)
    ? "Subsidiaries referenced in the tender; confirm the participating entity list"
    : "Participating entities are not stated in the available sources";
  const fte = source.match(/\b\d+\s*(?:FTE|full.time equivalents?)\b/i)?.[0];
  const inventory = asList(evaluation.source_inventory);
  const fact = (key) => values(facts[key])[0] || "";
  const short = (value) => value.length > 165 ? `${value.slice(0, 165).trimEnd()}…` : value;
  const capabilityCue = asList(evaluation.rejlers_review?.dimensions)
    .find((row) => row.key === "engineering_capability")?.items
    ?.flatMap((row) => asList(row.evidence))[0];

  const summaryRows = [
    ["Opportunity / Title", project],
    ["VF / Quote Code", record.deal_code || "Not assigned"],
    ["Client", clientDetail],
    ["In-Scope Subsidiaries / Entities", entityDetail],
    ["Primary Scope Workstreams", workstreams],
    [
      "Key Milestones & Schedule",
      distinct([
        "Submission due: " + analysisDueDateTime(record, summary),
        present(summary.submission_date) && present(record.submission_due_date) &&
          summary.submission_date !== record.submission_due_date &&
          `Saved CRM deadline: ${record.submission_due_date}; review whether these are the same milestone (${facts.submission_details?.[0]?.source_file || "tender"}, ${facts.submission_details?.[0]?.source_page || "location unavailable"}).`,
        ...milestones,
      ]).join("; ") || "Schedule requires confirmation",
    ],
    [
      "Commercial Framework",
      commercialFramework.join("; ") || "Commercial terms require review",
    ],
    ["Available Source Files", inventory.map((item) =>
      `${item.name} (${item.purpose && item.purpose !== "Purpose to verify" ? `likely ${item.purpose} by filename` : "purpose to verify"}${item.status !== "ready" ? `; ${item.status || "unread"}` : ""})`
    ).join("; ") || "No source inventory available"],
  ];
  const detailedSections = [
    {
      title: "Scope vs. Capabilities",
      bullets: distinct([
        "Tender scope: " + workstreams + ".",
        capabilityCue && `Tender requirement for capability review: ${short(capabilityCue.text || "")} (${capabilityCue.source_file || "source"}, ${capabilityCue.source_page || "location unavailable"}).`,
        has(/\b(?:sap|s\/4hana|oneerp)\b/) &&
          "SAP / OneERP delivery capability and partner capacity require internal confirmation.",
        has(/\btricentis\s+tosca\b/) &&
          "Confirm access to Tricentis Tosca tooling and specialists.",
        "Confirm Rejlers delivery fit against the approved capability and partner roster.",
      ]),
    },
    {
      title: "Strategic Fit",
      bullets: distinct([
        present(summary.client_name) && `Tender client: ${client}.`,
        fact("locations") && `Delivery geography: ${short(fact("locations"))}.`,
        "Compare the client, market and service scope with approved sales priorities.",
      ]),
    },
    {
      title: "Resource Requirements",
      bullets: distinct([
        locations.length &&
          "Delivery locations identified: " + locations.join(", ") + ".",
        fte && "The tender references " + fte + " of core-team capacity.",
        "Validate named FTE commitments, partner availability, and rules for overlapping assignments.",
      ]),
    },
    {
      title: "Execution & Schedule Risk",
      bullets: distinct([
        systems.length > 1 &&
          "Integration across " +
            systems.join(", ") +
            " requires defined third-party ownership.",
        has(/\b(?:freeze|downtime|upgrade|2509)\b/) &&
          "Align delivery milestones with vendor freezes and upgrade / downtime windows.",
        has(/\boneerp\b/) &&
          "Confirm OneERP release-management governance and approval gates.",
        "Agree the dependency plan before final bid commitment.",
      ]),
    },
    {
      title: "Commercial Attractiveness",
      bullets: distinct([
        fact("commercial_model") && `Tender commercial model: ${short(fact("commercial_model"))}.`,
        fact("payment_terms") && `Payment terms: ${short(fact("payment_terms"))}.`,
        "Profitability and bid effort require an approved estimate and commercial review.",
      ]),
    },
    {
      title: "Schedule Feasibility",
      bullets: distinct([
        present(summary.submission_date) && `Tender submission date: ${summary.submission_date}.`,
        fact("timeline") && `Delivery timing: ${short(fact("timeline"))}.`,
        "Confirm the submission window and delivery capacity before committing.",
      ]),
    },
  ];
  const clarificationRows = [];
  for (const item of asList(evaluation.critical_clarifications)) {
    const question = typeof item === "string" ? item : item?.question;
    if (!question) continue;
    if (
      clarificationRows.some(
        (row) => row.request.toLowerCase() === question.toLowerCase(),
      )
    )
      continue;
    clarificationRows.push({ title: "Bid requirement", request: question,
      evidence: asList(item?.evidence) });
  }
  const coverageRows = asList(evaluation.evidence_coverage);
  const coverage = (coverageRows.length ? coverageRows : [
    { title: "Operational integrations", evidence: asList(facts.technologies)
      .filter((row) => /integrat/i.test(row.value || row.finding || "")) },
    { title: "Data migration and governance", evidence: asList(facts.scope)
      .filter((row) => /data migration|data governance/i.test(row.value || row.finding || "")) },
  ]).map((group) => ({
    ...group,
    evidence: asList(group.evidence).map((item) => ({ ...item,
      sourceId: item.source_id || item.sourceId })),
  }));
  const drivers = distinct([
    fact("scope") && `Client scope: ${short(fact("scope"))}`,
    fact("deliverables") && `Required output: ${short(fact("deliverables"))}`,
    fact("submission_details") && `Submission requirement: ${short(fact("submission_details"))}`,
  ]).slice(0, 3);
  return {
    client,
    project,
    summaryRows,
    detailedSections,
    coverage,
    drivers: drivers.length ? drivers : ["No tender decision drivers established from readable sources."],
    concerns: distinct([
      fact("key_risks") && `Tender risk: ${short(fact("key_risks"))}`,
      inventory.some((item) => item.status !== "ready") && "Some source files were not fully read; check source coverage.",
      "Internal capability and qualification compliance unconfirmed; capacity and commercial return require confirmation.",
    ]).slice(0, 3),
    clarificationRows: clarificationRows.slice(0, 7),
  };
}
