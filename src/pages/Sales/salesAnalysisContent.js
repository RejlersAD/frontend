const asList = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const values = (rows) => asList(rows)
  .map((row) => typeof row === "string" ? row : row?.value || row?.finding)
  .filter(Boolean);
const present = (value) => value && !/^(unknown|not provided|not available|further client clarification required)$/i.test(String(value).trim());
const distinct = (items) => [...new Set(items.filter(Boolean))];

export function buildAnalysisContent(record, evaluation) {
  const summary = evaluation.opportunity_summary || {};
  const facts = summary.project_facts || {};
  const source = Object.values(facts).flatMap(values).join(" ");
  const lower = source.toLowerCase();
  const has = (pattern) => pattern.test(lower);
  const client = present(summary.client_name) ? summary.client_name : record.client_name || "Client to confirm";
  const project = present(summary.project_name) ? summary.project_name : record.deal_name || "Opportunity title to confirm";
  const scope = distinct([
    has(/\b(?:erp|sap|oneerp|s\/4hana)\b/) && "ERP implementation",
    has(/\b(?:gbs|global business services|operating model)\b/) && "GBS operating model",
    has(/\binfrastructure\b/) && "infrastructure",
    has(/\bcyber(?:security| security)\b/) && "cybersecurity",
  ]);
  const workstreams = scope.length ? scope.join(", ") : values(facts.scope)[0]?.slice(0, 180) || "Scope requires tender review";
  const locations = values(facts.locations);
  const systems = distinct([...source.matchAll(/\b(?:IMOS|AMOS|EyeShare|BOS|DigitALL Ocean|OneERP|SAP|HiBob|SuccessFactors)\b/gi)]
    .map((match) => match[0]));
  const milestones = distinct(values(facts.timeline)
    .flatMap((text) => [...text.matchAll(/\b(?:Q[1-4]\s+20\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}|20\d{2}-\d{2}-\d{2})\b/gi)]
      .map((match) => match[0]))).slice(0, 4);
  const commercialModel = present(evaluation.commercial_attractiveness?.contract_model)
    ? evaluation.commercial_attractiveness.contract_model : values(facts.commercial_model)[0];
  const paymentTerms = values(facts.payment_terms)[0];
  const commercialFramework = distinct([
    commercialModel,
    paymentTerms,
  ]);
  const entityDetail = distinct([...source.matchAll(/\b(?:Navig8|ZMI|ADNOC Logistics\s*&\s*Services|ADNOC L&S)\b/gi)]
    .map((match) => match[0])).join(", ") || "Entity list requires source review";
  const fte = source.match(/\b\d+\s*(?:FTE|full.time equivalents?)\b/i)?.[0];
  const crmClient = record.client_name || "Not recorded";
  const crmDeadline = record.submission_due_date || record.deadline || "Not recorded";
  const dateEvidence = asList(facts.submission_details)[0];
  const sourceDeadline = present(summary.submission_date) ? summary.submission_date : "Not confirmed in extracted evidence";
  const sourceDeadlineLabel = dateEvidence?.source_file
    ? `${sourceDeadline} (${dateEvidence.source_file}, ${dateEvidence.source_page || "location not specified"})`
    : sourceDeadline;
  const clientConflict = present(client) && present(crmClient) && client.toLowerCase() !== crmClient.toLowerCase();
  const deadlineConflict = present(sourceDeadline) && present(crmDeadline) && sourceDeadline !== crmDeadline;

  const summaryRows = [
    ["Opportunity / Title", project],
    ["VF / Quote Code", record.deal_code || "Not assigned"],
    ["Client", client + (clientConflict ? `; saved CRM client: ${crmClient} ? differs from tender; review record` : "")],
    ["In-Scope Subsidiaries / Entities", entityDetail + "; confirm participating entity scope"],
    ["Primary Scope Workstreams", workstreams],
    ["Key Milestones & Schedule", `Source-stated submission: ${sourceDeadlineLabel}; saved opportunity deadline: ${crmDeadline}${deadlineConflict ? " ? review whether this is the same milestone" : ""}; other milestones: ${milestones.join("; ") || "not extracted"}`],
    ["Commercial Framework", commercialFramework.join("; ") || "Commercial terms require review"],
  ];
  const detailedSections = [
    {
      title: "Scope vs. Capabilities",
      bullets: distinct([
        "Tender scope: " + workstreams + ".",
        has(/\b(?:sap|s\/4hana|oneerp)\b/) && "SAP / OneERP delivery capability and partner capacity require internal confirmation.",
        has(/\btricentis\s+tosca\b/) && "Confirm access to Tricentis Tosca tooling and specialists.",
        "Assess fit with Rejlers' engineering consulting and EPCM delivery model against its approved capability and partner roster; tender mentions do not establish a capability-match percentage.",
        "Qualification compliance requires verified registrations, certifications and relevant project references.",
      ]),
    },
    {
      title: "Strategic Fit",
      bullets: distinct([
        "Evaluate the scope against Rejlers' Energy, Oil & Gas, Power, Utilities, Industries and Digitalization priorities.",
        "Client relationship, competitive position, follow-on value and strategic fit require internal confirmation; the client name alone does not establish win probability.",
      ]),
    },
    {
      title: "Resource Requirements",
      bullets: distinct([
        locations.length && "Delivery locations are documented in the cited tender evidence.",
        fte && "The tender references " + fte + " of core-team capacity.",
        "Confirm named capacity and mobilization across Abu Dhabi / UAE, Saudi Arabia, India Delivery Center and Sweden; these are Rejlers capacity checks, not tender delivery locations.",
        "Validate partner availability and rules for overlapping assignments.",
      ]),
    },
    {
      title: "Execution & Schedule Risk",
      bullets: distinct([
        systems.length > 1 && "The tender names " + systems.join(", ") + "; confirm integration responsibility and effort.",
        has(/\b(?:freeze|downtime|upgrade|2509)\b/) && "Align delivery milestones with vendor freezes and upgrade / downtime windows.",
        has(/\boneerp\b/) && "Confirm OneERP release-management governance and approval gates.",
        "Agree the dependency plan before final bid commitment.",
        commercialFramework.length && "Extracted commercial terms: " + commercialFramework.join("; ") + ".",
        "Margin, payment exposure, bonds, liability and penalties require commercial and legal acceptance; a rate card does not establish profitability.",
      ]),
    },
  ];
  // Retain exact excerpts within the established assessment sections. Search cues
  // identify passages for review, not proof of service scope or company fit.
  const dimensions = asList(evaluation.rejlers_review?.dimensions);
  const sectionDimensions = [
    ["engineering_capability", "qualification_compliance"],
    ["strategic_fit", "win_probability", "strategic_value"],
    ["resource_availability"],
    ["commercial_attractiveness", "contract_risk", "delivery_feasibility"],
  ];
  detailedSections.forEach((section, index) => {
    for (const key of sectionDimensions[index]) {
      const dimension = dimensions.find((item) => item.key === key);
      const excerpt = asList(dimension?.items).flatMap((item) => asList(item.evidence))
        .find((item) => item.text && item.source_file && item.source_page);
      if (excerpt) section.bullets.push(
        `${dimension.title} — source passage for review: “${excerpt.text}” (${excerpt.source_file}, ${excerpt.source_page}).`,
      );
    }
  });
  const drivers = distinct([
    "Tender scope: " + workstreams,
    present(summary.client_name) && "Tender client: " + summary.client_name,
    commercialFramework.length && "Commercial basis extracted; acceptance remains pending",
  ]);
  const concerns = [
    "Engineering / EPCM capability and qualification compliance unconfirmed",
    "Named resources and mobilization unconfirmed",
    "Commercial and contractual acceptance pending",
    "Win probability and strategic value unverified",
  ];
  const clarificationRows = [];
  for (const item of asList(evaluation.critical_clarifications)) {
    const question = typeof item === "string" ? item : item?.question;
    if (!question) continue;
    if (/submission deadline/i.test(question) && present(summary.submission_date)) continue;
    if (clarificationRows.some((row) => row.request.toLowerCase() === question.toLowerCase())) continue;
    clarificationRows.push({ title: item.field?.replaceAll("_", " ") || "Bid requirement",
      request: question, evidence: asList(item.evidence) });
  }
  const coverageTopics = [
    ["Operational integrations", /\b(?:IMOS|AMOS|EyeShare|BOS|DigitALL|payroll interface|integration|interface)\b/i],
    ["IMOS voyage accounting", /\bIMOS\b/i],
    ["EyeShare invoice flow", /\bEyeShare\b/i],
    ["AMOS vessel management", /\bAMOS\b/i],
    ["DigitALL Ocean commercial flow", /\bDigitALL\s+Ocean\b/i],
    ["BOS bunker trading", /\bBOS\b/i],
    ["External payroll journals", /\bpayroll\b/i],
    ["Data migration and governance", /\b(?:material master|vendor master|data cleansing|migration|data ownership|master data)\b/i],
    ["Material master volume", /\b(?:500[,.]000|material(?:s)?\s+master)\b/i],
    ["Legal entities and company codes", /\b(?:legal entities|company codes?)\b/i],
    ["Finance transaction volumes", /\b(?:purchase orders|AP entries|AR entries|journal entries)\b/i],
    ["Cleansing cycles and ownership", /\b(?:cleansing|data ownership|data steward)\b/i],
    ["Nonproduction data masking", /\b(?:data masking|data scrambling|scrambl|masking)\b/i],
    ["ERP upgrade and release", /\b(?:2509|upgrade|freeze|downtime|release management|CAB|Tosca)\b/i],
    ["S/4HANA 2509 upgrade", /\b2509\b/i],
    ["Release approval and regression", /\b(?:CAB|Tosca|regression test|release management)\b/i],
    ["Cybersecurity and access", /\b(?:cybersecurity|identity|Entra|MFA|PAM|SOC|SIEM|residency|remote access)\b/i],
    ["Cybersecurity go-live gate", /\b(?:cybersecurity|security assessment|cyber approval)\b/i],
    ["Identity and remote access", /\b(?:Entra|MFA|PAM|identity|remote access|VPN|VDI)\b/i],
    ["Cloud and data residency", /\b(?:data residency|UAE.based|cloud subscription|tenant)\b/i],
    ["Security logs and monitoring", /\b(?:SIEM|SOC|logging|monitoring)\b/i],
    ["Vessel connectivity", /\b(?:vessel connectivity|satellite|ship.to.shore)\b/i],
    ["Subsidiary operating model", /\b(?:Navig8|ZMI|Mumbai|IOT|shared services|GBS)\b/i],
    ["Navig8 finance model", /\b(?:Navig8|Mumbai)\b/i],
    ["ZMI vessel teams", /\b(?:ZMI|integrated operating team|\bIOT\b)\b/i],
    ["L&S shared services transition", /\b(?:shared services|GBS)\b/i],
    ["Finance and VAT redesign", /\b(?:VAT|finance process|tax|vendor master)\b/i],
    ["Procurement and HCM redesign", /\b(?:procurement|HCM|payroll management|supplier management)\b/i],
    ["Cutover and stabilization", /\b(?:cutover|go.live|hypercare|read.only|training|data load)\b/i],
    ["Legacy ERP read-only cutover", /\b(?:read.only|legacy ERP|Dynamics)\b/i],
    ["Training and hypercare", /\b(?:training|hypercare)\b/i],
    ["Phased entity rollout", /\b(?:phased|rollout|phase.1|phase.2)\b/i],
  ];
  const evidenceRows = Object.values(facts).flatMap((rows) => asList(rows))
    .filter((row) => row && typeof row === "object" && row.source_file && row.source_page)
    .map((row) => ({ text: row.value || row.finding, excerpt: row.source_text || row.excerpt,
      source: row.source_file, location: row.source_page }));
  const extractedCoverage = coverageTopics.map(([title, pattern]) => {
    const seen = new Set();
    const evidence = evidenceRows.filter((row) => {
      if (!pattern.test(row.text || "")) return false;
      const key = `${row.source}:${row.location}:${row.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { title, evidence, mentions: evidence.length };
  });
  const coverage = Array.isArray(evaluation.evidence_coverage)
    ? evaluation.evidence_coverage.map((group) => ({ title: group.title,
      mentions: group.mentions || 0,
      evidence: asList(group.evidence).map((row) => ({ text: row.text,
        source: row.source_file, location: row.source_page, sourceId: row.source_id })) }))
    : extractedCoverage;
  const priorityTopics = ["EyeShare invoice flow", "AMOS vessel management", "BOS bunker trading",
    "Material master volume", "Cleansing cycles and ownership", "S/4HANA 2509 upgrade",
    "Cybersecurity go-live gate", "Navig8 finance model", "ZMI vessel teams",
    "Legacy ERP read-only cutover"];
  const priorityEvidence = priorityTopics.flatMap((title) => {
    const group = coverage.find((item) => item.title === title);
    return group?.evidence?.length ? [{ title, ...group.evidence[0] }] : [];
  });
  return { client, project, summaryRows, detailedSections, drivers, concerns,
    clarificationRows: clarificationRows.slice(0, 7), coverage, priorityEvidence };
}
