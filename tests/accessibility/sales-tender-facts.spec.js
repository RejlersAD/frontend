import { test, expect } from "@playwright/test";

const values = {
  project_name: "ADNOC L&S ERP Transformation",
  client: "ADNOC Logistics & Services",
  scope: "Design, implementation and rollout of a unified ERP platform.",
  disciplines: "SAP functional, data migration and cybersecurity.",
  technologies: "SAP S/4HANA and Microsoft Azure.",
  deliverables: "Migration plan, cutover plan and training material.",
  locations: "Abu Dhabi, UAE.",
  timeline: "Go-live Q4 2027.",
  key_risks: "Data migration quality risk.",
};

test("source facts remain visible before incomplete internal assessment and missing commercial terms", async ({
  page,
}) => {
  const facts = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      [
        {
          value,
          finding: value,
          source_text: value,
          source_file: "Synthetic ERP SOW.pdf",
          source_page: "Page 4",
          confidence: 86,
          status: "likely",
          verification_status: "Source Confirmed",
        },
      ],
    ]),
  );
  await page.route(
    "**/api/v1/sales/deals/synthetic-tender/analysis/**",
    (route) =>
      route.fulfill({
        json: {
          opportunity_id: "synthetic-tender",
          status: "partial",
          result: {
            manager_review: {
              status: "unavailable",
              tender_evaluation: {
                opportunity_summary: {
                  project_facts: facts,
                  field_diagnostics: Object.keys(values).map((key) => ({
                    field: key,
                    status: "Extracted",
                    evidence_found: true,
                    value: values[key],
                    reason: "Source evidence located in the tender document.",
                    source: "Synthetic ERP SOW.pdf",
                  })),
                },
                capability_assessment: { assessment: "Unknown" },
                critical_clarifications: [
                  {
                    field: "payment_terms",
                    question: "Please clarify payment terms.",
                  },
                ],
              },
            },
          },
        },
      }),
  );
  await page.goto("/tests/fixtures/sales-tender-facts.html");
  const heading = page.getByRole("heading", {
    name: "What we know — Tender facts",
  });
  await expect(heading).toBeVisible();
  const known = heading.locator("..");
  for (const value of Object.values(values))
    await expect(known).toContainText(value);
  await expect(known).toContainText("Source Confirmed");
  await expect(known).toContainText("Page 4");
  await expect(known).not.toContainText(
    "Further client clarification required",
  );
  await expect(
    page.getByRole("heading", { name: "Capability Assessment" }).locator(".."),
  ).toContainText("Internal review required");
  await page.getByRole("button", { name: "Next Actions", exact: true }).click();
  await expect(page.getByText("Please clarify payment terms.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Please confirm the scope",
  );
  await expect(page.locator("body")).not.toContainText(
    "Please confirm the required technology",
  );
});

test("evaluation fetch failures are explicit instead of silently appearing as missing tender facts", async ({
  page,
}) => {
  await page.route(
    "**/api/v1/sales/deals/synthetic-tender/analysis/**",
    (route) =>
      route.fulfill({
        status: 503,
        json: { detail: "Synthetic failure" },
      }),
  );
  await page.goto("/tests/fixtures/sales-tender-facts.html");
  await expect(page.getByRole("alert")).toContainText(
    "Tender evaluation could not be loaded",
  );
});
