# Central AI credentials

The administrator page is `/admin/ai-api-keys`, available from the existing
Administration menu. Its appearance and the other sidebar entries are preserved.
The API independently enforces active administrator access and existing module
permissions; staff status alone does not permit credential management.

## Administrator API

All paths are relative to `/api/v1/rbac/admin/ai-api-keys/`:

- `GET` lists safe provider configuration and named credential metadata.
- `POST` creates a write-only API key, with the current provider revision.
- `PATCH {id}/` updates a label, enabled state or replacement key. Omitting the
  replacement keeps the existing key.
- `DELETE {id}/` removes a credential using both current revisions. Removing the
  selected key does not select a replacement or reactivate environment secrets.
- `POST {id}/select/` explicitly selects the provider default.
- `PATCH providers/{provider}/` changes enabled state or its optional default model.
- `POST {id}/test/` tests the specified model using synthetic content only.

The page supports OpenAI, Anthropic and Gemini. It never retrieves a secret,
stores one in browser storage, or reflects raw provider/request errors. A fixed
mask indicates a stored key; it is not a returned secret suffix. Failed saves
retain input. Stale key edits require an explicit latest-state reload and review.
Missing server encryption configuration blocks credential writes visibly.

Connection-test success is limited to that provider/model and time. It does not
establish complete source extraction, accuracy, source authority or approval.

## Extraction interfaces

Ordinary users read only `/api/v1/rbac/ai-provider-status/`, containing provider,
managed/enabled/ready flags and model. Process extraction and cross-check controls
use this metadata instead of requiring a browser key. Each extraction endpoint
still authorizes the source and resolves its current provider credential.

PID Checker, P&ID Verification, I/O List, electrical checklist and paper
specification interfaces preserve provider/mode choices and remove normal user
credential entry. Known former session credential slots are retired without
reading their contents. Server-managed disablement cannot activate a legacy
browser key. Offline extraction remains separately selectable where supported.
Planning uses its effective project/server settings contract; Sales email already
uses server configuration.

## Local verification

Use Node 20 with:

```text
node node_modules/@playwright/test/cli.js test --config=playwright.admin-ai-api-keys.config.js
```

The isolated fixture server uses port 5191 and has no backend proxy. Browser
tests mock all API responses and block unrelated external requests. Coverage
includes administrator CRUD/default/provider settings, denial, missing
encryption, failed/stale input retention, synthetic-test failure, identity reset,
mobile layout and accessibility, ordinary-user no-key extraction, disabled and
unavailable providers, AI cross-checks, and readiness refresh after activation.
They make no real provider calls and contain no real credentials.

Legacy large P&ID Verification files already contain unrelated lint errors.
Differential lint verification should distinguish those from errors introduced
by this change. Production activation and successful use of actual credentials
require separate runtime evidence.
