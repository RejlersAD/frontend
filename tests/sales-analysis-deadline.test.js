import test from "node:test";
import assert from "node:assert/strict";
import { analysisDueDateTime } from "../src/pages/Sales/salesAnalysisDeadline.js";

test("shows the cited submission hour only for the matching date", () => {
  const summary = { submission_date: "2026-11-12", project_facts: { submission_details: [
    { value: "Response Due: 12-Nov-2026 10:58 AM GST" },
  ] } };
  assert.equal(analysisDueDateTime({}, summary), "12 Nov 2026 · 10:58 AM GST");
  assert.equal(analysisDueDateTime({}, { ...summary, submission_date: "2026-11-13" }),
    "13 Nov 2026 · time not stated");
  assert.equal(analysisDueDateTime({ submission_due_date: "2026-11-12" }, {
    project_facts: { submission_details: [{ value: "Due date: 11/12/2026 10:58 AM" }] },
  }), "12 Nov 2026 · 10:58 AM (time zone not stated)");
});

test("uses a saved timestamp when it matches and never invents a time from a date", () => {
  const record = { submission_due_date: "2026-11-12",
    qualification_data: { submission_deadline_at: "2026-11-12T06:58:00Z" } };
  assert.equal(analysisDueDateTime(record, {}), "12 Nov 2026 · 10:58 AM GST");
  assert.equal(analysisDueDateTime({ submission_due_date: "2026-11-12" }, {}),
    "12 Nov 2026 · time not stated");
});

test("uses today only when the dated email header matches the saved deadline", () => {
  const record = { submission_due_date: "2026-11-12" };
  const fact = { value: "Submission is at 10.58 AM today.", relative_date: "2026-11-12",
    source_file: "Incoming.eml", source_page: "Email body" };
  assert.equal(analysisDueDateTime(record, { submission_date: "Unknown",
    project_facts: { submission_details: [fact] } }),
  "12 Nov 2026 · 10:58 AM (time zone not stated)");
  assert.equal(analysisDueDateTime({ submission_due_date: "2026-11-13" }, {
    project_facts: { submission_details: [fact] } }), "13 Nov 2026 · time not stated");
});
