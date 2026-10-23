# HR-CV-ONE-01 — completed CV acknowledgement

Authorized 22 October 2026. Candidate details now includes Position Applied
and Nationality, supplied by schema v3 and retained in review/export and the
backend candidate register. Existing Current position remains separate.

After a successful CV submission, only the acknowledgement and Close page
action remain. The browser removes saved form credentials, attachments and
personal data from this view. Refresh retains the acknowledgement. A completed
private invitation or consumed shared CV link also shows only acknowledgement;
the latter makes no claim that the current visitor submitted the earlier CV.
Close page closes a script-opened tab where permitted, with about:blank as the
fallback for browsers that cannot close a normal tab.

Backend checks close the shared CV link after its first immutable submission,
including other browsers and already-open drafts. UI disabling alone is not
the submission guard. Pre-onboarding, Sidebar and shared-shell behavior remain
unchanged. See paired backend docs/HR_CV_SINGLE_USE.md for locking/API details.

Verified locally with 16 browser cases, scoped ESLint and a successful bundled
component dependency graph. Backend verification includes a real PostgreSQL
two-session submission race. This feature has not been deployed to production.
