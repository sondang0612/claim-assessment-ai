# Claim Assessment AI

> An AI-assisted medical insurance claim adjudication system built for Papaya Insurtech.

Accepts natural-language claim submissions, runs a deterministic four-step assessment workflow in real time, and produces audit-grade reports where every approval and rejection is traceable to a specific policy clause — with zero LLM involvement in business decisions.

---

## The Problem

Traditional claim adjudication suffers from one of two failure modes:

- **Manual review queues** — slow, error-prone, and inconsistently applied
- **Fully LLM-driven decisions** — non-deterministic, unauditable, and unpredictable for identical inputs

This system solves both without sacrificing speed or intelligence:

| Problem | Solution |
|---|---|
| Slow turnaround | Claims assessed in seconds, results streamed live step by step |
| Non-deterministic AI decisions | Business logic in TypeScript; LLM used only for field extraction |
| No audit trail | Every decision traces to a named policy clause (`EX-01`, `CV-02`, …) |
| Rule changes require code deploys | Admin panel for live CRUD on policies, rules, and documents |

---

## Features

### Claim Assessment Engine
- **Natural-language intake** — Reviewers describe a claim conversationally; the system parses it into structured fields using DeepSeek
- **Deterministic 4-step workflow** — Document verification → Policy lookup → Medical necessity → Benefit calculation, entirely in TypeScript
- **Real-time SSE streaming** — Each step, tool call, and report section streams live as it runs; no batch waiting
- **Clause-based audit trail** — Every decision maps to an explicit `clauseId` from the policy (`EX-01`, `CV-02`, …); no black-box reasoning
- **Coverage period enforcement** — Service date validated against `effectiveDate`/`expirationDate`; stale-active policies are rejected
- **Unapproved procedure enforcement** — Procedures not in the medically approved CPT set block approval even when the diagnosis is necessary
- **Empty document guard** — Claims submitted without any documents are rejected at Step 1 before any policy check

### Reviewer UI
- **Progressive typing animation** — Results appear character by character at ~300 chars/sec, synchronized with tool call indicators and report panel updates
- **Live tool call log** — Expandable panel shows each tool invocation with status (running / completed / failed), inputs, and raw output
- **Workflow timeline** — Horizontal step-progress strip tracks pending / running / completed / failed states in real time
- **Modal report viewer** — Full `AssessmentReport` opens in a modal with Prev/Next navigation between assessments, ESC to close, and a live badge during streaming
- **Multi-claim session** — Multiple claims assessed in one conversation; each run is an independent event; no prior results are overwritten
- **Conversation history** — Sessions persist to `localStorage` with search, rename, and delete; switching restores full state

### Admin Management Panel (`/admin`)
- **Policy manager** — Create, edit, and delete policies with dynamic coverage arrays, exclusion clauses, and coverage clause definitions; form validation prevents invalid configs
- **Medical necessity rules** — Add, edit, and delete ICD-10/CPT rules that drive the medical necessity gate; changes take effect on the next assessment with no restart
- **Document manager** — Track and update claim documents, statuses, and validation issues
- **Live CRUD API** — REST API (`/api/admin/*`) with validation; designed for drop-in replacement with a database-backed implementation

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Browser (Next.js)                             │
│                                                                         │
│  ┌───────────────┐  ┌─────────────────────────────┐  ┌───────────────┐ │
│  │   Sidebar     │  │         Chat Panel           │  │ Report Panel  │ │
│  │               │  │                              │  │               │ │
│  │ Conversation  │  │ Message thread (typewriter)  │  │ History list  │ │
│  │ list, search, │  │ Workflow step timeline        │  │ Modal detail  │ │
│  │ rename, delete│  │ Tool call log (live)          │  │ Audit trail   │ │
│  └───────────────┘  └──────────────┬───────────────┘  └───────────────┘ │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │  POST /api/agent → SSE stream
┌─────────────────────────────────────▼───────────────────────────────────┐
│                           Next.js API Route                             │
│                        app/api/agent/route.ts                           │
│                                                                         │
│   1. Classify message   (pure regex — zero LLM cost)                   │
│          ↓  claim_request only                                          │
│   2. Parse claim        (DeepSeek — field extraction only)             │
│          ↓  ParsedClaim { claimId, policyId, diagnosis, … }            │
│   3. streamAssessmentWorkflow()  →  AsyncGenerator<WorkflowEvent>      │
│          ↓  yield one WorkflowEvent per tool call and step              │
│   4. Stream as text/event-stream to browser                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      Assessment Workflow Engine                         │
│                   lib/workflow/assessmentWorkflow.ts                    │
│                                                                         │
│   ClaimDataManager (domain orchestration + memoization)                │
│   ├── verifyDocument()        →  valid | invalid | not found           │
│   ├── lookupPolicy()          →  Policy | not found                    │
│   ├── checkMedicalNecessity() →  necessary + CPT codes                 │
│   └── calculateBenefit()      →  coveredAmount + patientResponsibility │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        Admin Panel (separate)                           │
│                           /admin  →  /api/admin/*                      │
│                                                                         │
│   lib/store/policyStore.ts        ─── POST/PUT/DELETE /api/admin/...   │
│   lib/store/documentStore.ts           ↕  mutable in-memory stores     │
│   lib/store/medicalRuleStore.ts        ↕  (swap for DB with no UI      │
│                                            or tool changes)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key design principle

The LLM touches **exactly one stage**: converting a free-text message into a validated `ParsedClaim` struct (via Zod). Every downstream decision — policy validation, exclusion matching, medical necessity, benefit arithmetic, and the final recommendation — runs in deterministic TypeScript with no model involvement.

---

## Assessment Workflow

```
Claim submitted
      │
      ▼
[Step 1] Document Verification
  verifyDocument(documentId) × N docs
  ✓  valid — continues
  ✗  invalid / missing / not found
  ✗  empty documentIds array          →  MORE_INFO_REQUIRED  (halt)
      │
      ▼
[Step 2] Policy Lookup
  lookupPolicy(policyId)
  ✗  Policy not found                 →  REJECTED
  ✗  policy.status ≠ "active"         →  REJECTED
  ✗  serviceDate outside coverage     →  REJECTED
     window (effectiveDate–expirationDate)
  ✗  claimType in exclusions          →  REJECTED  (cite EX-XX clauseId)
  ✓  active + covered + not excluded
      │
      ▼
[Step 3] Medical Necessity
  checkMedicalNecessity(diagnosis, procedures)
  ✗  necessary = false                →  REJECTED
  ✗  unapprovedProcedures ≠ ∅         →  REJECTED  (lists CPT codes)
  ✓  necessary + all procedures approved
      │
      ▼
[Step 4] Benefit Calculation  (APPROVED path only)
  calculateBenefit(policyId, claimType, amount)
  → Applies coverage % and per-claim deductible
  → Caps at maxBenefit
  ✗  calculation failure              →  REJECTED
  ✓  returns coveredAmount + patientResponsibility
      │
      ▼
  APPROVED  /  REJECTED  /  MORE_INFO_REQUIRED
  + decisionMapping[]  ← one entry per factor (DOCUMENT/POLICY/MEDICAL/BENEFIT)
                          each with PASS/FAIL, clauseId, and plain-English explanation
  + policyCitations[]  ← verbatim policy text paired with clauseId and type
  + reasoning          ← summary sentence + keyDrivers[] list
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Node.js runtime) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| LLM provider | DeepSeek (`deepseek-chat` / `deepseek-reasoner`) via `@ai-sdk/openai` |
| Schema validation | Zod |
| Streaming | Server-Sent Events (SSE) via `ReadableStream` + `AsyncGenerator` |
| Testing | Vitest (122 tests, 9 suites) |
| State persistence | `localStorage` (versioned storage key `v3`) |

---

## Project Structure

```
claim-assessment-ai/
│
├── app/
│   ├── page.tsx                       # Root page — renders <ChatContainer />
│   ├── layout.tsx                     # Root layout (Geist fonts)
│   ├── admin/
│   │   ├── layout.tsx                 # Admin sidebar + nav layout
│   │   ├── page.tsx                   # Dashboard with live record counts
│   │   ├── policies/page.tsx          # Policy CRUD management
│   │   ├── medical-rules/page.tsx     # Medical necessity rule management
│   │   └── documents/page.tsx         # Document management
│   └── api/
│       ├── agent/route.ts             # POST /api/agent  — classify → parse → SSE stream
│       └── admin/
│           ├── policies/              # GET list, POST create, GET/PUT/DELETE by ID
│           ├── medical-rules/         # GET list, POST create, GET/PUT/DELETE by ID
│           └── documents/             # GET list (supports ?claimId=), POST/PUT/DELETE
│
├── components/
│   ├── admin/
│   │   ├── Modal.tsx                  # ESC-dismissible overlay modal
│   │   ├── DataTable.tsx              # Generic searchable table  Column<T>
│   │   ├── StatusBadge.tsx            # Color-mapped status pill
│   │   ├── PolicyForm.tsx             # Policy form (coverages[], exclusions[], clauses[])
│   │   ├── MedicalRuleForm.tsx        # Medical rule form (diagnosis + CPT codes)
│   │   └── DocumentForm.tsx           # Document form (type + issues[])
│   ├── chat/
│   │   ├── ChatContainer.tsx          # SSE consumer, animation queue, state root
│   │   ├── ChatInput.tsx              # Textarea + quick-scenario pills
│   │   ├── MessageBubble.tsx          # User/assistant message bubbles
│   │   ├── MessageList.tsx            # Scrollable thread with auto-scroll
│   │   ├── WorkflowTimeline.tsx       # Horizontal step progress strip
│   │   └── ToolCallLog.tsx            # Live tool execution panel
│   ├── report/
│   │   ├── MultiClaimReportPanel.tsx  # History list + modal detail view
│   │   ├── AssessmentReport.tsx       # Progressive 8-section report renderer
│   │   ├── RecommendationBadge.tsx    # APPROVED / REJECTED / MORE_INFO pill
│   │   └── ReportSection.tsx          # Collapsible accordion section
│   └── sidebar/
│       └── Sidebar.tsx                # Conversation history, search, rename, delete
│
├── lib/
│   ├── classifier/
│   │   └── requestClassifier.ts       # Regex classifier — zero LLM cost
│   ├── data/                          # Static seed data (source of truth on startup)
│   │   ├── claims.ts                  # 3 test scenarios (CLM-001 / 002 / 003)
│   │   ├── policies.ts                # 3 policies with clauseIds (POL-001 / 002 / 003)
│   │   ├── documents.ts               # 6 documents, 1 missing (DOC-003)
│   │   └── medicalCodes.ts            # 7 ICD-10 / CPT necessity rules with ruleIds
│   ├── domain/
│   │   └── ClaimDataManager.ts        # Orchestration layer: memoized tool calls,
│   │                                  # precheck, eligibility gate, claim context
│   ├── parser/
│   │   └── claimParser.ts             # LLM extraction → Zod validation
│   ├── providers/
│   │   └── deepseek.ts                # DeepSeek model provider (@ai-sdk/openai)
│   ├── store/                         # Mutable in-memory stores (init from lib/data/)
│   │   ├── policyStore.ts             # list / get / create / update / delete / exists
│   │   ├── documentStore.ts           # + listByClaimId
│   │   └── medicalRuleStore.ts        # + find(diagnosis) — substring match
│   ├── tools/                         # Pure functions, no side effects
│   │   ├── verifyDocument.ts
│   │   ├── lookupPolicy.ts
│   │   ├── checkMedicalNecessity.ts
│   │   └── calculateBenefit.ts
│   └── workflow/
│       └── assessmentWorkflow.ts      # runAssessmentWorkflow (sync, for tests)
│                                      # streamAssessmentWorkflow (async generator, for SSE)
│
├── types/
│   ├── agent.ts                       # ChatMessage
│   ├── claims.ts                      # Claim, ClaimType, Document, DocumentStatus
│   ├── conversation.ts                # Conversation, ClaimEvent (append-only log)
│   ├── policy.ts                      # Policy, Coverage, Exclusion (clauseId), CoverageClause
│   ├── report.ts                      # AssessmentReport, PartialAssessmentReport,
│   │                                  # DecisionFactor, PolicyCitation, ReasoningSection
│   └── workflow.ts                    # WorkflowEvent discriminated union (11 variants)
│
└── __tests__/                         # 9 test files, 122 assertions
    ├── scenario-a-approval.test.ts
    ├── scenario-b-rejection.test.ts
    ├── scenario-c-more-info.test.ts
    ├── claim-flow.test.ts
    ├── report.test.ts
    ├── report-citations.test.ts
    ├── tool-execution.test.ts
    ├── request-classifier.test.ts
    └── provider-deepseek.test.ts
```

---

## Setup

### Prerequisites

- Node.js 18+
- A DeepSeek API key — [platform.deepseek.com](https://platform.deepseek.com)

### Install

```bash
git clone <repo-url>
cd claim-assessment-ai
npm install
```

### Environment

Create `.env.local` in the project root:

```env
DEEPSEEK_API_KEY=your_key_here
```

### Run

```bash
npm run dev
```

| URL | Description |
|---|---|
| [http://localhost:3000](http://localhost:3000) | Claim assessment chat interface |
| [http://localhost:3000/admin](http://localhost:3000/admin) | Admin management panel |

### Test

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

### Type-check and lint

```bash
npx tsc --noEmit
npx eslint .
```

---

## API Reference

### `POST /api/agent`

Streams `text/event-stream` events for a claim assessment.

**Request**

```json
{
  "messages": [
    { "role": "user", "content": "Assess claim CLM-001 for John Doe, surgery for appendicitis, policy POL-001, documents DOC-001 and DOC-002, requesting $5,000" }
  ],
  "model": "deepseek-chat"
}
```

`model` defaults to `deepseek-chat`. Pass `deepseek-reasoner` for the chain-of-thought variant.

**SSE event stream** (in emission order)

| Event | Payload | UI action |
|---|---|---|
| `workflow-start` | `claimId` | Open claim event entry |
| `step-start` | `step`, `stepName` | Mark step as running in timeline |
| `tool-start` | `toolCallId`, `toolName`, `input` | Add running indicator to tool log |
| `tool-complete` | `toolCall`, `line` | Update tool log; type `line` into chat |
| `step-result` | `toolCall`, `line` | Legacy — handled by tool events |
| `step-complete` | `step`, `stepName`, `summary` | Mark step completed |
| `report-update` | `partial: PartialAssessmentReport` | Merge into report panel |
| `workflow-complete` | `recommendation`, `reasoning` | Type final assessment block |
| `final-report` | `report`, `toolCalls`, `summary` | Replace all partial state |
| `error` | `message` | Display error in chat |
| `message` | `messageClass`, `summary` | Static response (greeting / help) |

---

### Admin API (`/api/admin/*`)

All endpoints accept and return JSON. Validation errors return `{ error: string }` with appropriate 4xx status codes.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/policies` | List all policies |
| `POST` | `/api/admin/policies` | Create a policy (409 if ID exists) |
| `GET` | `/api/admin/policies/:id` | Get one policy |
| `PUT` | `/api/admin/policies/:id` | Update policy fields |
| `DELETE` | `/api/admin/policies/:id` | Delete policy |
| `GET` | `/api/admin/medical-rules` | List all necessity rules |
| `POST` | `/api/admin/medical-rules` | Create a rule |
| `GET` | `/api/admin/medical-rules/:id` | Get one rule |
| `PUT` | `/api/admin/medical-rules/:id` | Update rule fields |
| `DELETE` | `/api/admin/medical-rules/:id` | Delete rule |
| `GET` | `/api/admin/documents[?claimId=]` | List documents (optionally filtered) |
| `POST` | `/api/admin/documents` | Create a document |
| `GET` | `/api/admin/documents/:id` | Get one document |
| `PUT` | `/api/admin/documents/:id` | Update document fields |
| `DELETE` | `/api/admin/documents/:id` | Delete document |

---

## Mock Test Scenarios

Three end-to-end scenarios cover all three outcome paths:

| Scenario | Claim | Patient | Diagnosis | Policy | Outcome | Key reason |
|---|---|---|---|---|---|---|
| A — Approval | CLM-001 | John Doe | Appendicitis | POL-001 | **APPROVED** | All criteria pass; 90% surgery coverage (CV-02) |
| B — Rejection | CLM-002 | Jane Smith | Elective cosmetic surgery | POL-002 | **REJECTED** | Exclusion clause EX-01 (elective/cosmetic) |
| C — More info | CLM-003 | Bob Johnson | Femoral fracture repair | POL-003 | **MORE\_INFO\_REQUIRED** | Itemized bill DOC-003 missing (Section 3.1) |

Quick-submit buttons for all three are in the chat input.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| AI orchestration | Removed | Non-determinism is unacceptable in insurance adjudication |
| LLM role | Field extraction only (`generateText` + Zod) | `generateObject` / `json_schema` rejected by DeepSeek |
| Workflow | Sequential fixed-order TypeScript pipeline | Reproducible decisions; fully testable without an API key |
| Streaming | `AsyncGenerator<WorkflowEvent>` + SSE | Events emitted per tool call; UI updates incrementally |
| UI animation | Synchronized `scheduledEffectsRef` queue | Prevents panels updating before the text motivating them is visible |
| Report state | Append-only `ClaimEvent[]` log (UUID key, not claimId) | Supports re-assessment of the same claim without overwriting prior results |
| Clause tracing | `clauseId` on every `Exclusion` and `CoverageClause` | Every rejection/approval references a named policy source; no fabricated IDs |
| Admin storage | Module-level singleton stores initialized from seed data | Drop-in for a DB-backed implementation — no UI or tool changes required |

---

## Test Coverage

```
Test Files  9 passed
    Tests  122 passed

scenario-a-approval    — CLM-001 full approval path, benefit arithmetic
scenario-b-rejection   — CLM-002 exclusion gate, medical necessity failure
scenario-c-more-info   — CLM-003 missing document gate
claim-flow             — Full pipeline integration for all 3 scenarios
report                 — AssessmentReport structure, field values, recommendations
report-citations       — Policy citations, clauseId correctness, no hallucinated IDs
tool-execution         — Each tool in isolation: edge cases, deductible math, cap enforcement
request-classifier     — 37 patterns across all 4 classification categories
provider-deepseek      — Provider initialization, model selection, SDK shape
```

---

## Development Timeline

### Phase 1 — Type System and Domain Model

Project started with strict TypeScript interface definitions before any logic. `ClaimType`, `Policy`, `Coverage`, `Exclusion`, `Document`, `AssessmentReport`, and the full `WorkflowEvent` discriminated union were all specified upfront. Three concrete end-to-end test scenarios (APPROVED / REJECTED / MORE\_INFO\_REQUIRED) were authored in parallel so every subsequent implementation step had verifiable expected outcomes.

**Key decision:** Fix the scenarios first. Having three concrete expected outcomes meant no logic could be called "done" until all three paths produced the right result — without ever calling an API.

---

### Phase 2 — Tool Layer

Four pure functions implemented as the system's decision primitives:

- `verifyDocument` — looks up a document, returns validity and issue list
- `lookupPolicy` — retrieves a `Policy` with structured coverage and exclusions
- `checkMedicalNecessity` — matches ICD-10/plain-language diagnosis to a rule; returns approved CPT codes and any unapproved ones
- `calculateBenefit` — applies coverage percentage, per-claim deductible, and benefit cap

Each function has no side effects, no AI involvement, and a discriminated-union return (`{ success: true; … } | { success: false; error: string }`). This made them independently testable and directly composable into any workflow.

---

### Phase 3 — LLM-Orchestrated Workflow (replaced)

Initial implementation used AI SDK tool calling to orchestrate the four functions dynamically — the model decided which tools to call and in what order. This worked for the happy path but introduced non-determinism: the model occasionally skipped steps, reordered them, or changed reasoning for identical inputs.

**Key decision:** Replace orchestration entirely. Insurance adjudication requires reproducible decisions. Any variability in the execution path is a compliance risk.

---

### Phase 4 — Deterministic Workflow Engine

`runAssessmentWorkflow` replaced the AI orchestrator as a hardcoded sequential pipeline. The LLM was demoted to a single responsibility: parsing natural-language claim text into a validated `ParsedClaim` struct via `generateText` + `JSON.parse` + Zod.

All business logic moved into TypeScript with explicit priority rules:
- `MORE_INFO_REQUIRED` always precedes `REJECTED` — incomplete data trumps policy decisions
- Each `REJECTED` path has its own named condition (inactive policy / excluded claim type / not medically necessary / unapproved procedures)
- `APPROVED` is only reachable after all four checks pass

Identical input now produces identical output, every time.

---

### Phase 5 — Request Classification Layer

A zero-cost classifier was added before the parser. Pure regex categorizes every message as `claim_request | greeting | help_request | unsupported`. Greetings and help requests receive instant static responses. LLM calls and the workflow are gated entirely behind `claim_request` classification.

Eliminated unnecessary API calls for non-claim interactions and reduced average response latency for common inputs to under 10ms.

---

### Phase 6 — SSE Streaming and Real-Time UI

`streamAssessmentWorkflow` was added as an `AsyncGenerator<WorkflowEvent>`, yielding structured events as each step runs. The API route pipes these directly to the browser as `text/event-stream`. The UI processes events incrementally:

- `tool-start` → add a running indicator to the tool log
- `tool-complete` → update indicator; append the result line to the chat
- `report-update` → reveal the corresponding report section in the right panel
- `final-report` → replace all partial state with the complete report

A typing animation (`CHARS_PER_FRAME = 5`, ~300 chars/sec) makes streaming feel conversational rather than mechanical.

---

### Phase 7 — Synchronized Effect Queue

A timing gap caused report panels and tool indicators to update before their corresponding text was visible in the chat — the cause-and-effect illusion was broken.

The fix was a `scheduledEffectsRef` queue: a list of `{ fireAtPos, effect }` entries registered at the character position where the triggering text was enqueued. The `requestAnimationFrame` tick fires these effects at the exact moment the referenced text becomes visible. No React state changes run before the user has read the text that motivated them.

---

### Phase 8 — Conversation History and Multi-Claim Support

Sessions were made persistent using `localStorage`. Each conversation stores messages, tool calls, workflow steps, and claim events. A sidebar supports search, rename, and delete. Switching conversations fully restores all state without replaying animations.

Multiple claims per session are supported via an event-sourced model: each assessment appends a `ClaimEvent { eventId, claimId, timestamp, report }` to an append-only array. A client-generated UUID — not the `claimId` — is the key, so the same claim can be re-assessed multiple times without overwriting prior results.

---

### Phase 9 — Audit-Grade Clause Tracing

Policy data was extended with structured clause identifiers:

- `Exclusion.clauseId` — e.g. `EX-01` on the elective/cosmetic exclusion in POL-002
- `CoverageClause[]` on each `Policy` — e.g. `CV-02` for surgery coverage in POL-001

The assessment report gained three new audit fields:

- `decisionMapping[]` — one entry per evaluation factor (DOCUMENT / POLICY / MEDICAL / BENEFIT), each with a `PASS`/`FAIL` status, the relevant `clauseId`, and a plain-English explanation
- `policyCitations[]` — verbatim policy text paired with `clauseId` and `type` (exclusion / coverage / notes)
- `reasoning` — a summary sentence and a `keyDrivers[]` list

Every rejection is now traceable to a specific named clause. Every approval references the coverage clause that authorized it. No `clauseId` is fabricated — values come only from what `lookupPolicy` returns.

---

### Phase 10 — Edge Case Hardening

Three logic gaps identified that would pass all tests but fail in production:

**Coverage period not enforced.** The workflow checked `policy.status === 'active'` but never compared the service date against `effectiveDate`/`expirationDate`. A claim for an expired policy would approve if the status field was stale. Fix: `serviceDate` added to `ParsedClaim`; explicit `coveragePeriodValid` flag; clear rejection message when the check fails.

**Unapproved procedures silently approved.** `checkMedicalNecessity` returned `unapprovedProcedures[]` but the workflow only checked the `necessary` boolean. A claim with approved + unapproved procedures would clear the medical gate entirely. Fix: `hasUnapprovedProcedures` added as a dedicated `REJECTED` condition; unapproved codes listed in the report.

**Empty `documentIds` vacuously passed.** An empty array produced `allDocsValid = true`. A claim with no documents would approve if all other checks passed. Fix: `ParsedClaimSchema` enforces `.min(1)`; the workflow independently checks `hasDocuments` before evaluating validity.

All three fixes were additive — all 122 tests continued to pass.

---

### Phase 11 — Domain Orchestration Layer (ClaimDataManager)

All data access was centralized into a single `ClaimDataManager` class. The workflow layer now calls only this class; there are no direct imports from `lib/tools/*` or `lib/data/*` in the workflow.

Key capabilities:
- **Memoization** — repeated calls to the same tool return cached results; no double-recording
- **Precheck** (`runPrecheck`) — early eligibility assessment before running the full workflow
- **Eligibility gate** (`runEligibilityGate`) — combined check with risk flags
- **Claim context** (`buildClaimContext`) — full snapshot for observability tooling
- **Internal trace log** (`DataAccessLog[]`) — structured log of every data access for future audit pipelines

---

### Phase 12 — Admin Management Panel

A full CRUD admin interface was added at `/admin`, allowing rule changes without code modifications or server restarts.

**Data layer:** Three mutable store modules (`policyStore`, `documentStore`, `medicalRuleStore`) initialize from the static seed data and expose `list / get / create / update / delete` operations. The stores are module-level singletons; replacing them with DB-backed implementations requires no UI or tool changes.

**REST API:** Six route groups under `/api/admin/` with input validation and clear 4xx error responses.

**Admin UI:** Three management pages with searchable data tables, create/edit modals, dynamic form arrays (coverages, exclusions, clauses), field-level validation, delete confirmation, and toast notifications.

---

### Phase 13 — Enhanced Assessment Narration

The chat narration was enriched to read like an actual insurance assessor's review rather than a terse log output:

- **Document step** — Shows document type and provider alongside each verification result
- **Policy step** — Shows holder name, expiry date, deductible status, exact coverage terms, and the clause ID driving the decision (or the exclusion clause when denied)
- **Medical step** — Shows the matched diagnosis, full rationale, approved CPT codes, and the requested procedure list
- **Benefit step** — Shows a structured breakdown: requested amount, coverage %, deductible applied, covered amount, patient responsibility
- **Final assessment** — Numbered reasoning points (1–4) with PASS/FAIL status per factor, plus an explicit policy citation line referencing the governing clause

The report panel's Audit Trail entries were also expanded to include document types, diagnosis strings, and full clause text in each factor's explanation.

---

## License

Internal use — Papaya Insurtech.
