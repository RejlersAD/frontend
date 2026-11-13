import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysisContent } from "../src/pages/Sales/salesAnalysisContent.js";

test("executive cards use source facts and show incomplete attachments", () => {
  const content = buildAnalysisContent(
    { deal_code: "Q-1" },
    {
      source_inventory: [
        { name: "SOW.pdf", purpose: "Scope of Work", status: "ready" },
        {
          name: "price.xls",
          purpose: "Commercial document",
          status: "partial",
        },
      ],
      opportunity_summary: {
        project_facts: {
          scope: [
            { value: "Assess offshore structures", source_file: "SOW.pdf" },
          ],
          deliverables: [
            { value: "Issue structural passports", source_file: "SOW.pdf" },
          ],
          key_risks: [
            {
              value: "Client data availability may delay delivery",
              source_file: "SOW.pdf",
            },
          ],
        },
      },
    },
  );
  assert.match(content.drivers.join(" "), /Assess offshore structures/);
  assert.match(content.drivers.join(" "), /structural passports/);
  assert.match(content.concerns.join(" "), /Client data availability/);
  assert.match(content.concerns.join(" "), /not fully read/);
  assert.match(
    content.summaryRows.at(-1)[1],
    /price\.xls \(likely Commercial document by filename; partial\)/,
  );
  assert.ok(
    content.detailedSections.some(
      (row) => row.title === "Commercial Attractiveness",
    ),
  );
  assert.ok(
    content.detailedSections.some(
      (row) => row.title === "Schedule Feasibility",
    ),
  );
});
