import test from "node:test";
import assert from "node:assert/strict";
import {
  GO,
  NO_GO,
  generateBidJustification,
  intelligenceOf,
  goInsights,
  noGoReasonOptions,
} from "../src/pages/Sales/salesBidDecision.js";

const analysis = {
  status: "partial",
  counts: { ready: 1 },
  result: {
    manager_review: {
      tender_evaluation: {
        opportunity_summary: {
          client_name: "ADNOC Onshore",
          project_facts: {
            scope: [
              {
                value:
                  "Survey utility networks for leaks using an acoustic camera",
                source_file: "SOW.pdf",
                source_page: "Page 2",
              },
            ],
            deliverables: [
              {
                value: "Submit a leak detection survey report",
                source_file: "SOW.pdf",
                source_page: "Page 5",
              },
            ],
            timeline: [
              {
                value:
                  "Complete the survey in 15 days and issue the report in the next 15 days",
                source_file: "SOW.pdf",
                source_page: "Page 7",
              },
            ],
            payment_terms: [
              {
                value: "100% after survey report acceptance",
                source_file: "SOW.pdf",
                source_page: "Page 8",
              },
            ],
            submission_details: [
              {
                value: "Survey report due within 30 days",
                source_file: "SOW.pdf",
                source_page: "Page 5",
              },
            ],
          },
        },
      },
    },
  },
};

test("decision draft uses cited Opportunity Intelligence without invented company fit", () => {
  const intel = intelligenceOf(analysis);
  const draft = generateBidJustification(
    { client_name: "ADNOC Onshore" },
    GO,
    0,
    intel,
  );
  assert.match(
    draft,
    /Survey utility networks for leaks using an acoustic camera/,
  );
  assert.match(draft, /Submit a leak detection survey report/);
  assert.match(draft, /Complete the survey in 15 days/);
  assert.match(draft, /100% after survey report acceptance/);
  assert.doesNotMatch(
    draft,
    /strong strategic fit|available capacity|profitable|100% subcontracting/i,
  );
  assert.equal(intel.scope[0].source, "SOW.pdf, Page 2");
  assert.equal(
    goInsights(intel).find(
      (item) => item.label === "Company capability and capacity",
    ).evidence,
    false,
  );
});

test("No-Go requires an authored business reason; regeneration retains it", () => {
  const intel = intelligenceOf(analysis);
  const missing = generateBidJustification({}, NO_GO, 0, intel);
  assert.match(missing, /Add the specific business reason/);
  assert.doesNotMatch(missing, /100% subcontracting|no value addition/);
  const reason =
    "The survey would be fully subcontracted with no Rejlers value addition";
  for (const variant of [0, 1]) {
    const draft = generateBidJustification({}, NO_GO, variant, intel, reason);
    assert.match(
      draft,
      /Manager reason: The survey would be fully subcontracted/,
    );
    assert.match(draft, /Survey utility networks/);
  }
});

test("No-Go offers exactly three evidence-labelled, conditional business predictions", () => {
  const options = noGoReasonOptions(intelligenceOf(analysis));
  assert.deepEqual(
    options.map((option) => option.id),
    ["capacity", "commercial", "strategy"],
  );
  assert.equal(options[0].evidence.source, "SOW.pdf, Page 7");
  assert.equal(options[1].evidence.source, "SOW.pdf, Page 8");
  assert.equal(options[2].evidence.source, "SOW.pdf, Page 2");
  for (const option of options) {
    assert.match(option.reason, /^If /);
    assert.ok(option.prediction.length > 30);
    assert.doesNotMatch(
      option.reason,
      /resources are already committed|below target profitability|100% subcontracted/i,
    );
  }
  assert.equal(noGoReasonOptions()[0].evidence, null);
});
