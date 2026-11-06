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

  const summaryRows = [
    ["Opportunity / Title", project],
    ["VF / Quote Code", record.deal_code || "Not assigned"],
    ["Client", client],
    ["In-Scope Subsidiaries / Entities", entityDetail],
    ["Primary Scope Workstreams", workstreams],
    [
      "Key Milestones & Schedule",
      distinct([
        present(summary.submission_date) &&
          "Submission: " + summary.submission_date,
        ...milestones,
      ]).join("; ") || "Schedule requires confirmation",
    ],
    [
      "Commercial Framework",
      commercialFramework.join("; ") || "Commercial terms require review",
    ],
  ];
  const detailedSections = [
    {
      title: "Scope vs. Capabilities",
      bullets: distinct([
        "Tender scope: " + workstreams + ".",
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
        /adnoc/i.test(client + " " + project) &&
          "ADNOC provides a strategic UAE client opportunity.",
        has(/\b(?:energy|oil|gas|maritime|marine|shipping)\b/) &&
          "The tender sits within the energy / maritime market.",
        "Confirm the pursuit against the Abu Dhabi sales strategy and current client priorities.",
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
  ];
  const clarificationRows = [
    has(/\b(?:sap|s\/4hana|oneerp)\b/) &&
      has(/\b(?:upgrade|2509|freeze|downtime)\b/) && {
        title: "System upgrade timing and downtime",
        request:
          "Please confirm the SAP / OneERP upgrade window, planned downtime, freeze periods, and any impact on delivery milestones.",
      },
    systems.length > 1 && {
      title: "Third-party vendor support",
      request:
        "Please confirm the SLAs, named owners, and response commitments for legacy-system integration support.",
    },
    has(/\b(?:gbs|global business services)\b/) && {
      title: "GBS centralization boundaries",
      request:
        "Please confirm which services and entities are in scope for the GBS operating model and which remain local.",
    },
    has(/\b(?:cybersecurity|cyber security|infrastructure)\b/) && {
      title: "Remediation funding",
      request:
        "Please confirm who funds infrastructure and cybersecurity remediation identified during the engagement.",
    },
  ].filter(Boolean);
  for (const item of asList(evaluation.critical_clarifications)) {
    const question = typeof item === "string" ? item : item?.question;
    if (
      !question ||
      !/price|commercial|payment|scope|resource|schedule|deadline|contract|liabilit|integration/i.test(
        question,
      )
    )
      continue;
    if (
      /submission deadline/i.test(question) &&
      present(summary.submission_date)
    )
      continue;
    if (
      clarificationRows.some(
        (row) => row.request.toLowerCase() === question.toLowerCase(),
      )
    )
      continue;
    clarificationRows.push({ title: "Bid requirement", request: question });
  }
  return {
    client,
    project,
    summaryRows,
    detailedSections,
    clarificationRows: clarificationRows.slice(0, 7),
  };
}
