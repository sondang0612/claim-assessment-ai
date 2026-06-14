# Claim Assessment AI

An AI-assisted medical insurance claim adjudication system built for Papaya Insurtech. It accepts natural-language claim submissions, runs a deterministic four-step assessment workflow in real time, and produces audit-grade reports where every approval and rejection is traceable to a specific policy clause.

---

## Problem Statement

Traditional claim adjudication relies on manual review queues, opaque rule engines, or fully LLM-driven decisions that are non-deterministic and unauditable. This system solves three specific problems:

1. **Speed** — Claims are assessed in seconds, with step-by-step results streamed live to the reviewer.
2. **Auditability** — Every decision (APPROVED / REJECTED / MORE\_INFO\_REQUIRED) maps to an explicit rule: a policy clause ID, a document status, or a medical necessity code. There is no black-box reasoning.
3. **Correctness** — Business logic lives in TypeScript, not in LLM prompts. The LLM is used only to extract structured claim data from natural language. Decisions are never delegated to a model.

---

## Core Features

- **Natural-language claim intake** — Reviewers describe a claim conversationally; the system parses it into structured fields using DeepSeek.
- **Deterministic 4-step workflow** — Document verification → Policy lookup → Medical necessity → Benefit calculation. Every step is explicit TypeScript, not AI inference.
- **Real-time SSE streaming** — Workflow steps, tool calls, and report sections appear progressively as processing runs. No waiting for a batch result.
- **Clause-based audit trail** — Each policy exclusion and coverage area has a `clauseId` (e.g. `EX-01`, `CV-02`). Every decision entry in the report references the clause that drove it.
- **Coverage period enforcement** — Service date is validated against `effectiveDate` / `expirationDate`. A policy with status `active` but an expired coverage window is still rejected.
- **Unapproved procedure enforcement** — Procedures not in the medically approved set for the diagnosed condition block approval, even when the diagnosis itself is medically necessary.
- **Multi-claim session** — Multiple claims can be assessed in a single conversation. Each run is an independent event with its own report; no previous assessment is overwritten.
- **Conversation history** — Past sessions persist to `localStorage` with search, rename, and delete. Switching conversations fully restores state.
- **Modal report viewer** — A click-to-open modal presents the full assessment report with Prev/Next navigation between claims, ESC to close, and a live "Assessing…" badge during streaming.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                    │
│                                                             │
│  Sidebar (history)  │  Chat + Timeline  │  Report Panel     │
│  ─────────────────  │  ───────────────  │  ─────────────    │
│  Conversation list  │  Streaming thread │  History list     │
│  Search / rename    │  Workflow steps   │  Modal detail     │
│  localStorage sync  │  Tool call log    │  Audit trail      │
└────────────────────────────┬────────────────────────────────┘
                             │  POST /api/agent  →  SSE stream
┌────────────────────────────▼────────────────────────────────┐
│                      Next.js API Route                      │
│                   app/api/agent/route.ts                    │
│                                                             │
│  1. Classify message  (pure regex — no LLM)                 │
│       ↓ claim_request only                                  │
│  2. Parse claim  (DeepSeek — extraction only)               │
│       ↓ ParsedClaim { claimId, serviceDate, … }             │
│  3. streamAssessmentWorkflow()  →  AsyncGenerator           │
│       ↓ yield WorkflowEvent per step                        │
│  4. Stream SSE events to browser                            │
└─────────────────────────────────────────────────────────────┘
```

### Key design principle

The LLM touches exactly one stage: converting a free-text message into a validated `ParsedClaim` struct (via Zod). All downstream logic — policy validation, exclusion matching, medical necessity, benefit arithmetic, and the final recommendation — runs in deterministic TypeScript with no model involvement.

---

## Assessment Workflow

```
Claim submitted
      │
      ▼
[Step 1] Document Verification
  verifyDocument(documentId) × N
  → Each document: valid | invalid | not found
  → ANY failure → MORE_INFO_REQUIRED
  → Empty documentIds → MORE_INFO_REQUIRED
      │
      ▼
[Step 2] Policy Lookup
  lookupPolicy(policyId)
  → Policy not found         → REJECTED
  → Status ≠ active          → REJECTED
  → serviceDate outside      → REJECTED
    effectiveDate–expirationDate
  → Claim type excluded      → REJECTED  (cite EX-XX clauseId)
      │
      ▼
[Step 3] Medical Necessity
  checkMedicalNecessity(diagnosis, procedures)
  → necessary = false        → REJECTED
  → unapprovedProcedures ≠ ∅ → REJECTED  (lists unapproved CPT codes)
      │
      ▼
[Step 4] Benefit Calculation  (APPROVED path only)
  calculateBenefit(policyId, claimType, amount)
  → Applies coverage % and deductible
  → Caps at maxBenefit
  → Calculation failure      → REJECTED
      │
      ▼
  APPROVED  /  REJECTED  /  MORE_INFO_REQUIRED
  + decisionMapping[]  (one entry per factor, each with clauseId)
  + policyCitations[]  (clauseId + type + verbatim text)
  + reasoning          (summary + keyDrivers[])
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| LLM provider | DeepSeek (`deepseek-chat` / `deepseek-reasoner`) via `@ai-sdk/openai` |
| Schema validation | Zod |
| Streaming | Server-Sent Events (SSE) via `ReadableStream` |
| Testing | Vitest (122 tests, 9 suites) |
| State persistence | `localStorage` (versioned storage key) |

---

## Project Structure

```
claim-assessment-ai/
├── app/
│   ├── api/agent/route.ts        # SSE endpoint — classify → parse → stream
│   └── page.tsx                  # Root layout (Sidebar + Chat + Report)
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx     # SSE consumer, animation queue, state root
│   │   ├── WorkflowTimeline.tsx  # Step progress strip
│   │   └── ToolCallLog.tsx       # Live tool execution panel
│   ├── report/
│   │   ├── MultiClaimReportPanel.tsx  # History list + modal
│   │   └── AssessmentReport.tsx       # Report sections renderer
│   └── sidebar/
│       └── Sidebar.tsx           # Conversation history, search, rename
├── lib/
│   ├── classifier/
│   │   └── requestClassifier.ts  # Regex classifier — zero LLM cost
│   ├── data/
│   │   ├── claims.ts             # Mock claim scenarios
│   │   ├── policies.ts           # Mock policies with clauseIds
│   │   ├── documents.ts          # Mock documents per claim
│   │   └── medicalCodes.ts       # ICD-10 / CPT necessity rules
│   ├── parser/
│   │   └── claimParser.ts        # LLM extraction → Zod validation
│   ├── providers/
│   │   └── deepseek.ts           # DeepSeek model provider
│   ├── tools/
│   │   ├── verifyDocument.ts
│   │   ├── lookupPolicy.ts
│   │   ├── checkMedicalNecessity.ts
│   │   └── calculateBenefit.ts
│   └── workflow/
│       └── assessmentWorkflow.ts # Sync + streaming workflow variants
├── types/
│   ├── agent.ts                  # ChatMessage
│   ├── claims.ts                 # Claim, ClaimType, Document
│   ├── policy.ts                 # Policy, Exclusion (clauseId), CoverageClause
│   ├── report.ts                 # AssessmentReport, DecisionFactor, ReasoningSection
│   └── workflow.ts               # WorkflowEvent discriminated union (11 variants)
└── __tests__/                    # 9 test files, 122 assertions
```

---

## Setup

### Prerequisites

- Node.js 18+
- A DeepSeek API key ([platform.deepseek.com](https://platform.deepseek.com))

### Installation

```bash
git clone <repo-url>
cd claim-assessment-ai
npm install
```

### Environment

Create `.env.local`:

```env
DEEPSEEK_API_KEY=your_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test           # run once
npm run test:watch # watch mode
```

### Type check + lint

```bash
npx tsc --noEmit
npx eslint .
```

---

## API

### `POST /api/agent`

Streams Server-Sent Events for a claim assessment session.

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "Assess claim CLM-001 for John Doe..." }
  ],
  "model": "deepseek-chat"
}
```

**SSE event types** (in emission order)

| Event type | Description |
|---|---|
| `workflow-start` | Assessment begun; carries `claimId` |
| `step-start` | A workflow step is starting |
| `tool-start` | A tool call is about to execute |
| `tool-complete` | Tool returned; carries result + human-readable line |
| `step-result` | Summary of tool output for the step |
| `step-complete` | Step finished |
| `report-update` | Partial report snapshot; drives progressive rendering |
| `workflow-complete` | Final recommendation determined |
| `final-report` | Complete `AssessmentReport` + full tool call log |
| `error` | Workflow or parse failure |
| `message` | Non-claim response (greeting / help / unsupported) |

---

## Mock Test Scenarios

| Scenario | Claim | Policy | Outcome | Primary reason |
|---|---|---|---|---|
| A — Full approval | CLM-001 (John Doe, appendicitis) | POL-001 | APPROVED | All criteria pass; 90% surgery coverage |
| B — Rejection | CLM-002 (Jane Smith, cosmetic surgery) | POL-002 | REJECTED | Exclusion clause EX-01 (elective procedures) |
| C — More info | CLM-003 (Bob Johnson, fracture repair) | POL-003 | MORE\_INFO\_REQUIRED | Itemized bill DOC-003 missing |

---

## Development Timeline

### Phase 1 — Foundation and Type Definitions

The project started with defining the domain model in TypeScript before writing any logic. `ClaimType`, `Policy`, `Coverage`, `Exclusion`, `Document`, and `AssessmentReport` were all specified as strict interfaces. Mock data was created for three end-to-end test scenarios covering approval, rejection, and missing-documents paths.

**Key decision:** Fix the test scenarios first. Having three concrete, expected outcomes made every subsequent implementation step verifiable without running a real LLM.

---

### Phase 2 — Tool Layer

Four pure functions were implemented as the system's decision primitives:

- `verifyDocument` — looks up a document by ID, returns validity and issues
- `lookupPolicy` — retrieves a `Policy` object, returns structured coverage and exclusions
- `checkMedicalNecessity` — matches ICD-10 / plain-language diagnosis to a necessity rule; returns approved CPT codes
- `calculateBenefit` — applies coverage percentage, deductible, and benefit cap

Each function has no side effects, no AI involvement, and a well-typed discriminated-union return type (`{ success: true; ... } | { success: false; error: string }`). This made them independently testable and composable.

---

### Phase 3 — First LLM-Driven Workflow (later replaced)

Initial implementation used AI SDK tool calling to orchestrate the four tools dynamically. An LLM decided which tools to call and in what order. While this worked for simple cases, it introduced non-determinism: the model occasionally skipped steps, hallucinated tool results, or changed the reasoning path for identical inputs.

**Key decision:** Replace the orchestration layer entirely. Insurance adjudication requires reproducible decisions. Any variability in the decision path is unacceptable.

---

### Phase 4 — Deterministic Workflow Engine

`runAssessmentWorkflow` was introduced as a hardcoded sequential pipeline. The LLM was demoted to a single responsibility: extracting structured `ParsedClaim` fields from natural-language text via `generateText` + `JSON.parse` + Zod validation.

All business logic moved into TypeScript:
- Explicit decision priority: documents → policy → medical → benefit
- `MORE_INFO_REQUIRED` always takes precedence over `REJECTED` when documents are absent
- `REJECTED` is explicit for each failure reason with no fallthrough ambiguity

The system now produces identical output for identical input, every time.

---

### Phase 5 — Request Classification Layer

To avoid sending every user message to the LLM, a zero-cost classifier was added before the parser. Pure regex matching categorizes messages as `claim_request | greeting | help_request | unsupported`. Greetings and help requests receive an instant static response. LLM and workflow calls are gated entirely behind `claim_request` classification.

This eliminated unnecessary API costs for non-claim interactions and reduced average response latency for common inputs to under 10ms.

---

### Phase 6 — SSE Streaming and Real-Time UI

`streamAssessmentWorkflow` was added as an `AsyncGenerator<WorkflowEvent>`, emitting structured events as each step runs. The API route pipes these directly to the browser as `text/event-stream`. The UI processes events incrementally:

- `tool-start` → show a running indicator in the tool log
- `tool-complete` → update the indicator, append the result line
- `report-update` → reveal the corresponding report section in the right panel
- `final-report` → replace all partial state with the complete report

A typing animation (`CHARS_PER_FRAME = 5`, ~300 chars/sec) was layered on top to make the streaming feel conversational rather than mechanical.

---

### Phase 7 — Synchronized Effect Queue

A subtle UX race condition emerged: SSE events arrived at network speed while narration typed at ~300 chars/sec. Report panels and tool indicators updated before their corresponding text was visible, breaking the cause-and-effect illusion.

The fix was a `scheduledEffectsRef` queue — a list of `{ fireAtPos, effect }` entries registered at the character position where the triggering text was enqueued. The RAF tick drains these at the exact moment the referenced text becomes visible on screen. No React state changes fire before the user has seen the text that motivated them.

---

### Phase 8 — Conversation History and Multi-Claim Support

Sessions were made persistent using `localStorage`. Each conversation stores messages, tool calls, workflow steps, and claim events. A sidebar supports search, rename, and delete. Switching conversations fully restores all state without replaying animations.

Within a session, multiple claims were supported using an event-sourced model: each assessment run appends a `ClaimEvent { eventId, claimId, timestamp, report }` to an append-only array. Using a client-generated UUID as the key (not the claimId) means the same claim can be re-assessed without overwriting prior results.

A bug discovered here: `streamingEventId` was set on assessment start but never cleared on completion, causing the report panel to stay locked in "live" state after streaming ended. The fix added `setStreamingEventId(null)` at all three streaming-end code paths (tick drain, SSE close, and both catch blocks).

---

### Phase 9 — Audit-Grade Clause Tracing

Policy data was extended with structured clauses:

- `Exclusion.clauseId` — e.g. `EX-01` on the elective/cosmetic exclusion in POL-002
- `CoverageClause[]` on each `Policy` — e.g. `CV-02` for surgery coverage in POL-001

The assessment report gained three new audit fields:

- `decisionMapping[]` — one entry per evaluation factor (DOCUMENT / POLICY / MEDICAL / BENEFIT), each with a PASS/FAIL status, the relevant `clauseId`, and a plain-English explanation
- `policyCitations[]` — verbatim policy text paired with `clauseId` and `type` (exclusion / coverage / notes)
- `reasoning` — a structured summary and `keyDrivers[]` list

Every rejection is now traceable to a specific clause. Every approval references a coverage clause. No clauseId is fabricated — values come only from what `lookupPolicy` returns.

---

### Phase 10 — Edge Case Hardening

An audit review identified three logic gaps that would survive all existing test scenarios but fail in production:

**Coverage period not enforced.** The workflow checked `policy.status === 'active'` but never compared the service date against `effectiveDate` / `expirationDate`. A claim for an expired policy would approve if the status field was stale. Fix: added `serviceDate` to `ParsedClaim`, added explicit `coveragePeriodValid` flag, and surfaced a clear rejection message when the check fails.

**Unapproved procedures silently approved.** `checkMedicalNecessity` returned `unapprovedProcedures[]` but the workflow only checked the `necessary` boolean. A claim including the approved procedure plus several unapproved ones would clear the medical gate entirely. Fix: `hasUnapprovedProcedures` was added as a dedicated REJECTED condition with the unapproved codes listed in the report.

**Empty `documentIds` vacuously passed.** An empty array produced `invalidDocs = []` and `allDocsValid = true`. A claim with no supporting documents would approve if all other checks passed. Fix: `ParsedClaimSchema` enforces `.min(1)` on the documents array, and the workflow independently checks `hasDocuments` before evaluating document validity.

All three fixes were additive — all 122 existing tests continued to pass without modification.

---

## Test Coverage

```
Test Files  9 passed
    Tests  122 passed

Coverage areas:
  scenario-a-approval     — CLM-001 full approval path
  scenario-b-rejection    — CLM-002 exclusion + necessity failure
  scenario-c-more-info    — CLM-003 missing document gate
  claim-flow              — Full pipeline for all three scenarios
  report                  — AssessmentReport structure and field values
  report-citations        — Policy citations and clauseId correctness
  tool-execution          — Each tool in isolation
  request-classifier      — 30+ classification patterns
  provider-deepseek       — Provider initialization
```

---

## License

Internal use — Papaya Insurtech.
