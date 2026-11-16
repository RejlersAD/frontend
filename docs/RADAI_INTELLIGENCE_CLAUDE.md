# RADAI Intelligence Claude connection

## Authorization and scope

The user authorized connecting the existing administrator-managed Anthropic key to RADAI Intelligence while retaining the backend on Railway. The user explicitly authorized project knowledge and conversation attachment excerpts in Claude requests. This is scoped to the corrected `/api/v1/ai-workspaces/` chat and does not settle the broader D-11 data classification, retention, or other-module provider policy.

## Implemented route

The authenticated model list advertises Claude only when the selected central Anthropic credential is enabled and decryptable. Its configured model is used; when blank, the chat uses `claude-sonnet-4-6`. The browser sends the provider/model pair. The backend validates that pair, resolves the selected credential on every send, retrieves only evidence already authorized for that user and conversation, and records the actual provider, model, citations, usage, and audit metadata. The API key stays server-side. Claude is listed first and is the default when ready, so a Railway deployment without local Ollama can use it immediately after configuration. Local Ollama remains available when configured. There is no automatic fallback between models.

## Activation and verification

In Administration > AI API keys, add an Anthropic key, select it as default, enable Anthropic, and set/test a supported model. Test both general chat and a project chat with a synthetic document before real project use. No key is placed in frontend variables. Existing Railway backend deployment and its encryption configuration must be healthy. No schema migration is needed. Disable Anthropic in the same admin page to stop new Claude sends; existing historical answers and audit records remain.
