# Project Control product model

This document is the source of truth for user-facing terminology and navigation.
Existing API resource names and URLs remain unchanged for backwards compatibility.

## Terminology

| Term | Definition |
| --- | --- |
| Project Control | The enterprise module used to plan, measure, forecast, and govern project delivery. |
| Portfolio | The list of projects a user is authorised to access. |
| Project | The primary controlled business object, with its own status, dates, scope, cost, and governance. |
| Plan & Baseline | The project area for preparing, reviewing, approving, and publishing the delivery plan. |
| Planning Workspace | The working environment used to develop WBS, activities, logic, resources, and schedule controls. |
| Planning Package | A controlled planning deliverable or version. It is not a separate application. |
| Data date | The reporting cut-off date used for progress and forecast calculations. |
| Baseline | An approved, immutable reference plan used to measure variance. |

## Information architecture

The global navigation exposes one Project Control destination: Portfolio. After a
project is selected, the project-level navigation exposes the following work areas:

1. Overview
2. Plan & Baseline
3. Cost & Commercial
4. Estimates
5. Documents
6. Risks & Changes (when enabled)
7. Reports & Governance (when enabled)
8. Settings (when enabled)

Schedule authoring uses five stages:

1. Setup
2. Collect Inputs
3. Build Plan
4. Validate & Approve
5. Publish Baseline

Detailed tools such as WBS, EDDR, manhours, narrative, presentation, and export
remain available within the appropriate stage; they are not separate lifecycle steps.
