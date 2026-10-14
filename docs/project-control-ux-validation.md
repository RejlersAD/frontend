# Project Control UX and accessibility release gate

Last engineering run: 8 September 2026

## Current status

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Public login WCAG 2.2 AA scan | Pass | Playwright + axe: no critical or serious violations |
| Login keyboard reachability | Pass | Browser test moves focus using the keyboard |
| Login reflow at 320 CSS pixels | Pass | No page-level horizontal overflow |
| Protected-route authentication guard | Pass | `/projects` returns an unauthenticated user to sign-in |
| Authenticated Project Control scan | Not run | Set `PW_TEST_EMAIL` and `PW_TEST_PASSWORD` for a non-production test account |
| Planner, Controller and PM task sessions | Not run | Requires representative users and a seeded pilot project |
| NVDA/Chrome and VoiceOver/Safari | Not run | Requires manual assistive-technology sessions |

Run the automated gate from `frontend`:

```powershell
$env:PW_TEST_EMAIL = 'test-account@example.com'
$env:PW_TEST_PASSWORD = 'test-account-password'
npm run test:a11y
```

Credentials are read only from the process environment and must not be committed.
Without them, the public checks run and authenticated journeys are explicitly
reported as skipped. Open the generated report with `npm run test:a11y:report`.

## Task-based walkthrough

The following critical paths were traced against the implemented routes and
interactive states. A moderated test with representative planners and project
controllers is still required before production sign-off.

| Task | Expected path | Result |
| --- | --- | --- |
| Open an authorised project | Project Control > project selector | Implemented; automated authenticated run pending |
| Review project health | Select project > Overview | Implemented; automated authenticated run pending |
| Prepare a project plan | Plan & Baseline > Setup / Collect Inputs | Implemented; automated authenticated run pending |
| Build a schedule | Build Plan > WBS / Schedule / EDDR / Manhours | Implemented; moderated usability test pending |
| Validate and publish | Validate & Approve > Publish Baseline | Implemented; moderated governance test pending |
| Edit an activity | Planning Workspace > Activities & Gantt | Implemented on desktop; 200% zoom observation pending |
| Find unavailable capabilities | Project work-area navigation | Implemented; role-based user testing pending |

## WCAG 2.2 AA engineering checks

- One labelled global Project Control destination.
- Project selector and project work-area navigation have accessible names.
- Current destinations expose `aria-current`.
- Locked planning stages use native `disabled` and `aria-disabled`.
- Project progress exposes progressbar value semantics.
- Search, filter, upload-category, and new-activity controls have accessible names.
- Status and error notifications use appropriate live regions.
- Main Project Control dialogs expose dialog semantics, trap focus, close with
  Escape when safe, and restore focus to the invoking control.
- Icon-only destructive and pagination actions have accessible names and
  enlarged targets.
- Reduced-motion preferences disable non-essential animation and transitions.
- Dark theme has scoped surface, text, and border fallbacks.

## Human test protocol

1. Complete every critical task with at least one project controller, planner, and project manager using project `5900913`.
2. Test keyboard-only operation and visible focus at 100% and 200% zoom.
3. Test NVDA/Chrome and VoiceOver/Safari announcements and reading order.
4. Measure text, control, status, and chart contrast in both themes.
5. Test reflow at 320 CSS pixels and determine an alternative to wide editable tables.
6. Verify destructive-action wording against backend retention and recovery policy.

Record completion time, errors, assistance required, and participant comments for
each task. A task passes only when the participant completes it without facilitator
intervention and understands the resulting project state.
