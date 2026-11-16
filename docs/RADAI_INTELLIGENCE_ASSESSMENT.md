# RADAI Intelligence — Executive Platform Assessment

**Prepared by:** Principal Product Architect / AI Platform Reviewer  
**Date:** 16 November 2026  
**Scope:** RADAI Intelligence (frontend `radai-frontend`, Django backend APIs `/api/v1/ai-workspaces/` and `/api/v1/projects/{id}/ai-*`, live route `/radai-intelligence`)  
**Evidence base:** Inspected source files, `docs/` (PRD v0.1, MODULE_CATALOG v0.3, ARCHITECTURE v0.1, DATA_MODEL v0.1, DECISIONS v0.1, API_CONTRACTS v0.1, METRICS v0.1, WORKFLOWS v0.1), passing node tests (`tests/sales-executive-brief.test.js`, `tests/sales-decision-intelligence.test.js` — 4/4 pass).

---

## 1. Current Module Status

RADAI Intelligence is not one module. It is two overlapping AI implementations layered on top of an engineering consultancy ERP/platform (RADAI), plus a separate deterministic sales intelligence layer. Nothing below is backend-verified; status reflects inspected frontend code and documented contracts.

| # | Module | Purpose | Maturity | Working today | Missing | Dependencies / blockers |
|---|--------|---------|----------|---------------|---------|-------------------------|
| 1 | **AI chat (live route `/radai-intelligence`)** | Project- or workspace-scoped Q&A over uploaded/linked project documents, with cited sources, conversation history, quick actions, model selection (Ollama). | Functional MVP (narrow scope) | Send/receive messages, per-project and general conversations, attachments (12 MB), source excerpts with document/revision/location/approval, partial-coverage flags, conversation rename/archive/search, file generation from chat (docx/xlsx/pdf/csv/txt), 7-field project instructions, workspace members (viewer/editor). | Multi-document reasoning, long-context, web search, M365/SharePoint/email connectors, structured data extraction into business records, report templates, collaboration ("Cowork ... not available in this phase"), "Add to project / Connectors / Design system / Web search" all disabled ("Coming soon"). | Local Ollama only (`provider: ollama`, `data_policy=onprem`); `manage.py configure_ollama_intelligence --model qwen3:8b`; cloud provider calls rejected. Backend AI execution, model hub, and usage recording not inspected. |
| 2 | **AI Workspaces (`/api/v1/ai-workspaces/`)** | Independent AI workspaces (no canonical project required), owner/editor/viewer membership, versioned instructions, private knowledge, activity log, optional enterprise project link. | Partial | Create/rename/archive workspaces, upload knowledge, member management, instructions with optimistic concurrency (`expected_version`), activity events, explicit conversation share. | No cross-workspace knowledge, no workspace templates, no governance/approval of workspace content, enterprise link is read-only identifier (no document import). | D-02 tenancy, D-03 roles, D-11 AI data eligibility/retention all open. |
| 3 | **Legacy project intelligence (`/api/v1/projects/{id}/ai-*`)** | Canonical-project-scoped instructions, knowledge sources (Project Control documents or CRS revisions), conversations. | Partial | Seven-field instructions, link documents/CRS revisions, preview extracted pages, retry failed processing, conversation history with per-request UUID dedup. | Requires `pid_analysis.read` to chat; CRS knowledge requires `crs_documents.read` + exact P&ID evidence link; legacy only, not the corrected workflow. | D-06 CRS meaning unconfirmed; legacy and corrected models co-exist with no inferred mapping. |
| 4 | **Engineering evidence panel** (`RadaiEngineeringPanel`) | Deterministic P&ID evidence review (validation against active Line List, submit for human review), CRS revision embedded-text comparison, EPC work items. | Partial (functional, deterministic — not AI) | Extraction state, fingerprint, validation pass/fail, comparison diff, submission for review, links to P&ID module and Project Control. | No AI-assisted review, no cross-discipline reasoning, no schedule/cost impact analysis, bounded to linked CRS chain. | P&ID checker v2 and Line List APIs; CRS semantics (D-06) unconfirmed. |
| 5 | **AI document generation** | Generate docx/xlsx/pdf/csv/txt from a conversation; explicitly labeled "proposals, not engineering-approved". | Prototype | Format selection, filename, download, generated-document metadata in message. | No templates, no controlled-issue workflow, no approval routing, no branding, no structured data output. | Conversation must exist; generation is unstructured LLM output. |
| 6 | **Sales Opportunity Intelligence** (`src/pages/Sales/salesAnalysisContent.js`, `salesBidDecision.js`) | Deterministic tender/opportunity analysis: executive summary cards, GO/NO-GO bid justification, three evidence-labelled No-Go hypotheses, scope/timeline/payment extraction with source file/page citations. | Functional MVP (deterministic, tested) | 4 passing unit tests; sourced facts only, rejects invented claims (no "strong strategic fit", "profitable", "100% subcontracting"); manager-authored No-Go reason required. | Not connected to RADAI Intelligence chat; no AI involvement, no multi-tender comparison, no forecast integration, no opportunity dashboard AI layer. | Sales opportunity data shape (`SalesOpportunityAnalysis`); reviewed but not integrated into AI workspace. |
| 7 | **AI Champion admin** (`/admin/ai-champion`) | AI execution, usage/cost estimates, failures, adoption, accepted outcomes reporting. | Prototype (catalog only) | Page exists in module catalog; contract describes usage capture and token usage on messages. | No inspected implementation; no evaluation dashboard, no model comparison, no cost alerting. | Backend AI usage events not inspected. |

**Business value delivered today:** A user can upload project documents, ask a question, and receive an answer with source excerpts — scoped to one project/workspace, using a local model, with output labeled non-authoritative. Separately, sales staff can generate deterministic, sourced bid-justification drafts from tender data. That is the sum of delivered AI business value. There is no enterprise knowledge memory, no agent execution, no tender analysis assistant, and no executive briefing capability.

---

## 2. Capability Gap Analysis (vs Claude-level target)

| Capability | Why it matters | Current limitation | Impact on users | Recommended solution |
|---|---|---|---|---|
| **Document Intelligence** | Engineering decisions turn on exact clauses, values, and revisions in controlled documents. | Single-document excerpts only; scanned/image-only PDFs flagged "needs_review"; no structured fact extraction; no document classification. | Users must read full documents themselves; AI cannot reliably answer "what is the penalty clause?" across a document set. | Page/section-granular extraction pipeline with structured fact schema (ExtractionRun/ExtractedFact pattern already in DATA_MODEL.md), review workflow, confidence scoring. |
| **Multi-document reasoning** | Tender and engineering answers require cross-referencing SOW, price sheet, standards, and prior revisions. | Chat is scoped to excerpts from retrieved sources; no synthesis across documents; no conflict detection (e.g., price.xls partial vs SOW ready). | Contradictions between sources go unnoticed; users miss commercial risk. | Multi-hop retrieval over a project knowledge graph; explicit conflict/gap surfacing in answers. |
| **Long-context understanding** | RFPs and engineering packages run to hundreds of pages. | Bounded excerpts; truncation state recorded; partial coverage flagged; no recursive summarization; context is per-message, not per-project. | Answers miss late-document conditions; users cannot trust completeness. | Hierarchical summarization + working memory per project; query expansion; coverage reporting per answer. |
| **Knowledge memory** | Enterprise value grows as the system learns project standards, client preferences, and past decisions. | Static 7-field instructions only; no memory across conversations; no feedback loop; no accepted-output tracking. | Every conversation starts from scratch; repeated corrections; no institutional learning. | Persistent project knowledge base with accepted-output linkage, instruction versioning tied to outcomes, feedback capture (thumbs up/edit/accept). |
| **Agent workflows** | Repetitive engineering intelligence (P&ID check → validation → submission) should run with minimal clicks. | Deterministic validation exists but is manually triggered; no tool use, no planners, no autonomous retries, no orchestration across systems. | Staff perform copy-paste orchestration between P&ID module, Line List, and chat. | Tool-use agent with existing deterministic tools as first actions (validate P&ID evidence, compare revisions), human approval gates for state changes. |
| **Opportunity intelligence** | Bid/no-bid decisions are the firm's highest-stakes commercial acts. | Deterministic sales modules exist and are tested, but are not accessible from AI chat; no AI-assisted tender ingestion or risk scoring. | Sales reps toggle between systems; AI cannot answer "should we bid this tender?" | Integrate salesBidDecision/intelligenceOf outputs into AI workspace context; tender document → structured opportunity facts pipeline. |
| **Tender analysis** | Tender evaluation requires scope, commercial terms, risks, and capability fit from multiple documents. | No tender intake workflow in AI; salesAnalysisContent is keyword/heuristic based, not AI-powered; no go/no-go recommendation engine. | Manual tender review; inconsistent coverage; slow bid response. | AI tender-analysis agent: ingest SOW/price/conditions, produce sourced gap/risk register, draft justification (reuse salesBidDecision contract). |
| **Executive briefings** | Executives need portfolio-level exceptions, not project chat. | No executive briefing generated by AI; W.1 Executive overview is a metrics dashboard over defined metrics, not AI-authored. | Executives consume static dashboards, not synthesized, source-grounded briefings. | AI-authored executive briefings from authorized aggregates with drill-through citations, exception narratives, and freshness metadata. |
| **Search and retrieval** | Findability is the precondition for all knowledge value. | Keyword search over linked knowledge only; no hybrid/vector search, no ranking tuning, no cross-project search, no search over conversations. | Users cannot locate relevant documents they do not already know exist. | Permission-aware hybrid search (keyword + vector) across documents, conversations, and structured records; snippets subject to same entitlement as content. |
| **Citations and evidence grounding** | Trust requires verifiable evidence; unverified AI output cannot become an engineering record. | Citations are document/revision/location/approval excerpts; no page-quoted evidence in every claim; no "no answer when unsupported" enforcement; AI answers cannot update business records. | Users cannot distinguish model interpretation from source fact; risk of acting on hallucinated content. | Claim-to-source mapping with quoted spans, confidence, "unsupported claim" marking, retrieval evaluation harness, and human review before any business use. |
| **Workspace management** | Teams need shared, governable AI workspaces. | Workspaces exist with members/instructions, but no templates, no sharing controls beyond read-only named members, no activity correlation to business outcomes. | Workspaces are personal sandboxes, not team knowledge assets. | Workspace templates by discipline/use case, sharing roles tied to project membership, activity-to-outcome linkage, archive/retention policy. |
| **Collaboration** | Engineering decisions are team acts. | "Cowork ... not available in this phase"; conversations owner-private with explicit read-only share; no co-editing, comments, or assignment. | Knowledge silos in personal chats; no review/escalation path. | Shared conversations with comment/assign, review approval of AI outputs before use, @mentions linking to business records. |
| **Report generation** | Decisions must be recorded and distributed as controlled documents. | Unstructured "Create file from chat" (docx/xlsx/pdf/csv/txt); no templates; no controlled issue; labeled not engineering-approved. | Outputs cannot be used as deliverables without manual recreation. | Template-based report generation (tender evaluation, executive brief, engineering review) with controlled-issue workflow and revision. |
| **Learning from previous interactions** | Competitive AI workspaces improve with use. | No feedback capture, no fine-tuning data pipeline, no accepted-output catalog, no preference memory. | Same mistakes repeated; no measurement of AI value. | Feedback events on every AI message, accepted-outcome linkage, eval harness comparing model runs, prompt/instruction versioning. |
| **Autonomous task execution** | The differentiator vs a chatbot is doing work, not talking about it. | No action tools; no connectors (M365, SharePoint, email, ERP); "Coming soon" placeholders. | Users execute every downstream step manually. | Connector framework with approved integrations first (document control, sales opportunities), agent planning with human-in-the-loop gates. |
| **Human-in-the-loop review** | AI output must never silently become an approved engineering/financial record (AGENTS.md rule). | P&ID review has a human submit step; AI chat answers have no review/accept workflow; generated files labeled but not routable. | Unreviewed AI content can circulate as if authoritative. | Review-and-accept workflow for AI outputs with provenance, reviewer sign-off, and linkage to the source business record before controlled issue. |

---

## 3. Platform Limitations (prioritized by business impact)

### Product
1. **It is a document chatbot, not an intelligence platform.** No memory, no agents, no multi-document reasoning, no tender/executive workflows. Adoption will plateau at individual power users; teams cannot standardize on it. *(High)*
2. **Disabled collaboration and ecosystem.** Cowork, connectors, web search, and "Add to project" are all "Coming soon". Workspaces cannot become shared team assets. *(High)*
3. **Workflow friction.** Users must manually open P&IC module, Line List, and chat in sequence; no task orchestration; no report templates. *(Medium)*
4. **Inconsistent maturity.** Two AI implementations (legacy canonical-project + corrected workspaces) co-exist with no mapping; UI/UX differs between `/radai-intelligence` and the unrouted legacy `RadaiIntelligencePage`. *(Medium)*

### Data
1. **Extraction quality unvalidated.** Files are "unverified" until a controlled workflow confirms approval; scanned/image-only content needs manual review; no confidence scores or conflict detection. *(High)*
2. **No knowledge persistence across interactions.** Each conversation is context-isolated; instructions are static text with no outcome linkage. *(High)*
3. **Missing structured data.** Tender, opportunity, and deal data exist in Sales but are not consumable by AI; extraction outputs never write to business records. *(Medium)*
4. **Source reliability boundaries unclear.** D-02/D-05/D-11 (tenancy, system-of-record boundaries, AI data eligibility) remain open; it is not documented which client data may be sent to the model. *(Medium)*

### AI
1. **Hallucination risk.** Answers are model-generated excerpts with citations but no claim-level grounding, no "refuse when unsupported" behavior, no retrieval quality evaluation. *(High)*
2. **Weak reasoning for engineering tasks.** Bounded excerpts, no multi-hop reasoning, no deterministic verification integrated into the answer path (validation exists only as a separate manual button). *(High)*
3. **No memory.** No cross-conversation learning, no accepted-output tracking, no preference or instruction evolution. *(Medium)*
4. **Inconsistent recommendations.** Single local model (qwen3:8b via Ollama), no model comparison, no A/B or eval harness, no prompt versioning tied to outcomes. *(Medium)*
5. **Insufficient evidence traceability.** Citations reference documents, not quoted spans; no evidence that model proved each claim; no feedback loop. *(Medium)*

### Engineering
1. **Security/governance undefined.** D-11 open: AI data classification, provider eligibility, retention, and sensitive logging are not policy. Local-only model limits enterprise flexibility; cloud provider path is rejected rather than governed. *(High)*
2. **Architecture bottleneck.** All AI traffic funnels through one local Ollama instance; 240 s send / 120 s document generation timeouts; no job queue visibility for AI runs; 20-item pagination with no stated performance budgets (D-12 open). *(Medium)*
3. **Scalability concerns.** No vector store, no indexing service, no horizontal AI scaling described; per-user workspaces could proliferate without governance. *(Medium)*
4. **Technical debt.** Duplicate AI implementations (legacy vs corrected) with unconfirmed mapping; no contract tests for AI endpoints; frontend lint is the only automated check for AI pages (Playwright e2e exists but is visual/a11y-focused). *(Medium)*

---

## 4. Strategic Next Steps (priority order)

| # | Recommendation | Business justification | User value | Technical effort | Expected impact | Dependencies |
|---|----------------|----------------------|------------|------------------|-----------------|--------------|
| 1 | **Claim-level grounding and retrieval evaluation** (quoted spans, unsupported-claim marking, "no answer" behavior, eval harness) | Removes the top trust blocker; AI output cannot become an engineering record without evidence (AGENTS.md). | Answers users can act on; auditable provenance. | Medium | High — converts chatbot into trustable decision support. | Retrieval pipeline; D-11 data eligibility; D-06 CRS semantics. |
| 2 | **Human-in-the-loop review and accept workflow for AI outputs** (review → accept → controlled issue linkage) | Required before AI touches engineering/commercial records; satisfies review gates in WORKFLOWS.md. | AI outputs become usable deliverables with accountability. | Medium | High — unlocks business use of generated content. | Workflow service; approval routes (D-04). |
| 3 | **Cross-project / multi-document knowledge memory** (permission-aware hybrid search, project working memory, accepted-output catalog) | Makes RADAI learn across projects; the core differentiation vs a stateless chatbot. | Answers improve with use; institutional knowledge retained. | Medium-High | High — enterprise knowledge layer. | Vector/indexing service; D-02 tenancy. |
| 4 | **AI-assisted tender/opportunity intelligence integrated in workspace** (tender ingestion → sourced gap/risk register → bid justification reusing `salesBidDecision` contract) | Direct revenue impact: faster, more consistent bid/no-bid decisions; uses already-tested deterministic sales modules. | Sales reps get sourced Go/No-Go drafts inside AI chat. | Medium | High — ties AI to the firm's highest-stakes commercial process. | Sales opportunity data shape; D-08 enquiry/sales boundary. |
| 5 | **Agent skeleton with deterministic first tools** (P&ID validation, revision comparison as callable tools with approval gate) | Moves from "chat about work" to "AI executes steps of work". | Fewer manual hand-offs between P&ID module, Line List, and chat. | High | Medium-High — path to autonomous workflows. | Item 1 and 2; tool-use framework; D-07 for external adapters. |
| 6 | **AI governance, cost, and model management** (multi-provider gateway, usage/cost dashboards in AI Champion, retention policy, eval leaderboard) | Enterprise requirement before production expansion; D-11/D-12. | Predictable cost, model quality visibility, policy compliance. | Medium | Medium — de-risks rollout. | Backend usage events; D-11 decisions. |

**Focus:** Items 1–4 are the highest-leverage. Do not accumulate features; finish grounding, review, memory, and tender intelligence before agents.

---

## 5. Roadmap to Claude-Level Intelligence

### Phase 1 — Reliable Intelligence Foundation
**Objectives:** Make every AI answer verifiable and safe to act on; establish single coherent AI product (merge/retire legacy implementation).  
**Deliverables:**
- Claim-to-source mapping with quoted page/section spans and confidence
- "No supported evidence" refusal behavior and conflict flagging between sources
- Retrieval evaluation harness (precision/recall on project document sets; regression tests)
- Retire or map legacy `/api/v1/projects/{id}/ai-*` onto the corrected workspaces model
- Governance baseline: AI data-eligibility policy (D-11), retention, provider allow-list
**Success criteria:** 90% of sampled answers contain verifiable citations; zero unsupported factual claims in reviewed sample; eval suite runs in CI.
**Risks:** Evaluation ground truth is expensive to build; local model quality ceiling may force provider gateway decisions earlier than planned.

### Phase 2 — Enterprise Knowledge Layer
**Objectives:** RADAI learns and reasons across projects and documents.  
**Deliverables:**
- Permission-aware hybrid search across documents, conversations, and structured records
- Project working memory (hierarchical summaries) + accepted-output catalog
- Multi-document synthesis with explicit conflict/gap reporting
- Workspace templates by discipline (tender review, P&ID review, executive brief)
- Feedback events on every AI message; instruction versioning tied to outcomes
**Success criteria:** Cross-document questions answered correctly with sources; knowledge reuse measured (repeat project patterns, accepted outputs); search adoption > chat-only usage.
**Risks:** Indexing permission drift (search results must match record entitlements); vector-store operational overhead; user trust in synthesized answers.

### Phase 3 — Intelligent Agents
**Objectives:** Autonomous workflows and decision support with human gates.  
**Deliverables:**
- Tool-use agent: first tools = validate P&ID evidence against Line List, compare CRS revisions, run tender gap analysis
- Plan-and-execute for multi-step requests (e.g., "review this tender and draft the bid justification")
- Human-in-the-loop review/accept workflow before any business-record write
- Connectors: document control, Sales opportunities (D-05/D-08 boundaries)
- Template-based report generation with controlled issue
**Success criteria:** Agent completes a defined workflow (e.g., P&ID review submission) with fewer user steps; review acceptance rate; zero unauthorized state changes.
**Risks:** Agent autonomy creating duplicate or conflicting business effects (idempotency, optimistic concurrency required); tool failure recovery; approval SLA bottlenecks.

### Phase 4 — Executive Intelligence Platform
**Objectives:** Strategic recommendations, forecasting, portfolio insights.  
**Deliverables:**
- AI-authored executive briefings with drill-through to authorized records
- Portfolio risk and opportunity intelligence across tenders and projects
- Forecasting inputs from pipeline and delivery data (labeled provisional)
- Executive dashboard with natural-language drill-down ("which projects are at risk and why")
- Decision-support simulations (bid price sensitivity, resource capacity)
**Success criteria:** Executives use AI-generated briefings as primary intelligence source; briefings traceable to source records; forecasting accuracy measured against outcomes.
**Risks:** Over-reliance on AI-generated strategy; data quality of underlying metrics (METRICS.md definitions not yet implemented); executive access control boundaries (D-03).

---

## 6. Executive Verdict

**Current maturity score: 26 / 100**  
A functional, narrow project-scoped document chat with deterministic engineering validation and tested sales bid-decision helpers — but no memory, no agents, no multi-document reasoning, no governance, and no enterprise workflows.

**Readiness by capability area (0–100):**
- Project-scoped document chat with citations: 55
- Workspace scaffolding & membership: 60
- Deterministic sales opportunity intelligence: 40
- Engineering evidence validation (P&ID, CRS compare): 35
- Citations & evidence grounding: 30
- Document generation: 20
- Search & retrieval: 20
- Long-context & multi-document reasoning: 10
- Knowledge memory / learning: 5
- Collaboration: 10
- Agent workflows / autonomous execution: 0
- Executive briefings & portfolio intelligence: 0
- AI governance, eval, and cost management: 5

**Biggest strengths:**
- Honest AI behavior by design: outputs labeled proposals, non-engineering-approved; citations present (PRD FND-08 followed in code)
- Deterministic, tested sales intelligence that rejects invented claims (4/4 tests pass) — a rare, trustworthy foundation for tender decisions
- Clean separation of source fact / planning assumption / derived result in ARCHITECTURE.md; optimistic concurrency and idempotency patterns established
- Local-first model approach keeps data on-premise (matches engineering consultancy sensitivity)

**Critical weaknesses:**
- No retrieval quality evaluation or claim-level grounding; hallucination risk unmanaged
- No memory across conversations; no accepted-output tracking; system does not learn
- Two divergent AI implementations with no migration path; legacy vs corrected ambiguity
- No connectors, collaboration, or agent tool use; "Coming soon" placeholders across the menu
- No tender-analysis or executive-briefing workflows despite being the highest-value use cases
- Open governance decisions (D-02, D-03, D-05, D-06, D-11) block production AI rollout

**Top 5 priorities:**
1. Claim-level grounding + retrieval evaluation (trust foundation)
2. Human-in-the-loop review/accept workflow for AI outputs (business usability)
3. Cross-project knowledge memory + hybrid search (differentiation from chatbot)
4. AI-assisted tender/opportunity intelligence integrated in the workspace (revenue impact)
5. AI governance, multi-provider management, and cost/eval dashboard (production readiness)

**Overall recommendation:** Do not market RADAI Intelligence as an enterprise AI workspace today. It is a credible internal pilot for project document Q&A and deterministic bid justification. To become a differentiated **engineering intelligence platform** (not another AI document chatbot), RADAI must close the loop between AI answers and controlled business records: grounded citations, human review/accept, cross-project memory, and agents that execute P&ID/tender workflows under approval gates. The sales bid-decision modules are the strongest existing asset — integrate them into AI chat first, then build the review and memory layers that let outputs actually be used.

### Answer: What must RADAI Intelligence build next to become a genuinely differentiated engineering intelligence platform rather than just another AI document chatbot?

**Build a reviewable, source-grounded action layer on top of the chat.** Specifically: (1) claim-level citations with quoted spans and a "no answer when unsupported" policy; (2) a human-in-the-loop review-and-accept workflow that lets an AI output (tender gap analysis, P&ID review, bid justification) become a controlled business record with provenance; and (3) agent tools that execute the firm's actual engineering workflows — validate P&ID evidence against the Line List, compare CRS revisions, ingest tenders into the already-tested sales intelligence model — each under an approval gate. Memory (cross-project accepted outputs and working context) is what makes it improve over time; without review, memory, and tool use, RADAI Intelligence remains a chat window over files, not an engineering intelligence platform.
