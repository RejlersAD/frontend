import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysisContent } from "../src/pages/Sales/salesAnalysisContent.js";

test("management content uses tender facts and leaves unsupported specialist claims out", () => {
  const result = buildAnalysisContent(
    { deal_code: "Q-102126", deal_name: "ERP Transformation", client_name: "ADNOC L&S" },
    { opportunity_summary: {
      project_name: "ADNOC L&S ERP Transformation", client_name: "ADNOC L&S",
      submission_date: "2026-11-27",
      project_facts: {
        scope: [{ value: "OneERP implementation and GBS operating model across ADNOC L&S subsidiaries" }],
        technologies: [{ value: "SAP S/4HANA upgrade; IMOS and AMOS integrations" }],
        timeline: [{ value: "Design through Q4 2026 and rollout in Q1 2027" }],
        commercial_model: [{ value: "T&M" }],
        payment_terms: [{ value: "Milestone payments" }],
      },
    }, commercial_attractiveness: { contract_model: "T&M" } },
  );
  assert.equal(result.summaryRows[1][1], "Q-102126");
  assert.match(result.summaryRows.find(([label]) => label === "Primary Scope Workstreams")[1], /ERP implementation/);
  assert.match(result.summaryRows.find(([label]) => label === "Commercial Framework")[1], /T&M/);
  assert.equal(result.clarificationRows.length, 0);
  assert.ok(result.detailedSections.some((section) => section.title === "Resource Requirements"));
  assert.doesNotMatch(JSON.stringify(result), /Tricentis Tosca/);
});

test("saved CRM values remain distinct from tender facts and uncovered topics are visible", () => {
  const result = buildAnalysisContent(
    { deal_code: "Q-1", client_name: "RADAI Test Client", submission_due_date: "2026-11-19" },
    { opportunity_summary: { client_name: "ADNOC Logistics & Services", submission_date: "2026-07-06",
      project_facts: { technologies: [{ value: "IMOS integrates with SAP", source_file: "SOW.pdf", source_page: "Page 9" }],
        submission_details: [{ value: "6 July 2026", source_file: "Invitation.eml", source_page: "Email body" }] } } },
  );
  assert.match(result.summaryRows.find(([label]) => label === "Client")[1], /differs from tender/);
  assert.match(result.summaryRows.find(([label]) => label === "Key Milestones & Schedule")[1], /review whether/);
  assert.match(result.summaryRows.find(([label]) => label === "Key Milestones & Schedule")[1], /Invitation\.eml, Email body/);
  assert.equal(result.coverage.find((group) => group.title === "Operational integrations").evidence.length, 1);
  assert.equal(result.coverage.find((group) => group.title === "Data migration and governance").evidence.length, 0);
});

test("tooling is mentioned only when the source contains it", () => {
  const result = buildAnalysisContent({ deal_code: "Q-1" }, {
    opportunity_summary: { project_facts: { technologies: [{ value: "Tricentis Tosca test automation" }] } },
  });
  assert.match(result.detailedSections[0].bullets.join(" "), /Tricentis Tosca/);
});

test("server source coverage retains its page identity", () => {
  const result = buildAnalysisContent({ deal_code: "Q-1" }, {
    evidence_coverage: [{ title: "IMOS voyage accounting", mentions: 2, evidence: [
      { text: "IMOS sends invoices to SAP", source_file: "SOW.pdf", source_page: "Page 18", source_id: "sow-1" },
    ] }],
    opportunity_summary: { project_facts: {} },
  });
  assert.equal(result.coverage.length, 1);
  assert.equal(result.coverage[0].mentions, 2);
  assert.equal(result.coverage[0].evidence[0].sourceId, "sow-1");
});

test("source-backed clarification retains its exact citation", () => {
  const result = buildAnalysisContent({ deal_code: "Q-1" }, {
    critical_clarifications: [{ field: "source_quantity_conflict", question: "Please confirm eight (12).",
      evidence: [{ source_file: "SOW.pdf", source_page: "Page 27", source_text: "eight (12) weeks" }] }],
    opportunity_summary: { project_facts: {} },
  });
  assert.equal(result.clarificationRows[0].evidence[0].source_page, "Page 27");
});


test("Rejlers evidence enriches existing sections without implying internal capability", () => {
  const result = buildAnalysisContent({}, { rejlers_review: { dimensions: [{
    key: "engineering_capability", title: "Engineering capability match", items: [{ evidence: [{
      text: "Provide FEED services", source_file: "SOW.pdf", source_page: "Page 8",
    }] }],
  }] } });
  assert.equal(result.detailedSections.length, 6);
  assert.equal(result.summaryRows.length, 8);
  assert.match(result.detailedSections[0].bullets.join(" "), /Provide FEED services.*SOW.pdf, Page 8/);
  assert.match(result.concerns.join(" "), /capability and qualification compliance unconfirmed/);
  assert.doesNotMatch(JSON.stringify(result), /92%|Fully compliant|Strong position/);
});
