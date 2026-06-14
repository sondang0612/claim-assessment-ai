# Claim Assessment AI

An AI-assisted medical insurance claim adjudication system built for Papaya Insurtech.

Accepts natural-language claim submissions, runs a deterministic four-step assessment pipeline in real time, and produces audit-grade reports where every approval and rejection is traceable to a specific named policy clause — with zero LLM involvement in any business decision.

---

## The Problem

Traditional claim adjudication has two failure modes:

| Mode | Problem |
|---|---|
| Manual review | Slow, inconsistent, error-prone |
| Fully LLM-driven | Non-deterministic output for identical inputs; non-auditable |

This system solves both. The LLM handles exactly one task: parsing free-text into structured fields. Every downstream decision — policy validation, exclusion matching, medical necessity, benefit arithmetic, final recommendation — runs in deterministic TypeScript.

---

## Features

### Claim Assessment Engine

- **Natural-language intake** — Reviewers describe a claim conversationally; DeepSeek extracts structured fields
- **Deterministic four-step workflow** — Document verification → Policy lookup → Medical necessity → Benefit calculation, all in TypeScript; no model involvement in decisions
- **Clause-based audit trail** — Every decision maps to a named policy clause (`EX-01`, `CV-02`, …); no fabricated IDs
- **Unapproved procedure detection** — CPT codes not in the approved set for a diagnosis are tracked and flagged in the report
- **Priority-ordered rejection logic** — `MORE_INFO_REQUIRED` always precedes `REJECTED`; incomplete documentation trumps policy or medical decisions

### Reviewer UI

- **Real-time SSE streaming** — Each tool call and report section streams live as it runs; no batch waiting
- **Typewriter animation** — Results appear at ~300 chars/sec with report panel and tool indicators synchronized to the visible text, not to network arrival time
- **Live tool call log** — Expandable panel shows each tool invocation with running/completed status, inputs, and raw output
- **Workflow timeline** — Horizontal step-progress strip tracks pending / running / completed / failed states
- **Progressive report panel** — `AssessmentReport` grows section by section as each step completes; sections show "Pending…" until their step runs
- **Multi-claim session** — Multiple claims assessed in one conversation; each run appends to an event log; prior results are never overwritten
- **Conversation history** — Sessions persist to `localStorage` (versioned key `v3`) with search, rename, and delete; switching conversations restores full state
- **Abort** — Any in-flight assessment can be cancelled mid-stream

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js App)                         │
│                                                                      │
│  components/sidebar/Sidebar.tsx                                      │
│    conversation list, search, rename, delete, new assessment         │
│                                                                      │
│  components/chat/ChatContainer.tsx  ← root state + SSE consumer     │
│    ├── MessageList.tsx       scrollable message thread               │
│    ├── MessageBubble.tsx     user / assistant bubble                 │
│    ├── ChatInput.tsx         textarea + 3 quick-scenario buttons     │
│    ├── WorkflowTimeline.tsx  horizontal step-progress strip          │
│    └── ToolCallLog.tsx       live tool execution panel               │
│                                                                      │
│  components/report/MultiClaimReportPanel.tsx                         │
│    ├── AssessmentReport.tsx  8-section progressive report            │
│    ├── ReportSection.tsx     collapsible accordion section           │
│    └── RecommendationBadge.tsx  APPROVED / REJECTED / MORE INFO pill │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  POST /api/agent  →  SSE stream
┌──────────────────────────▼───────────────────────────────────────────┐
│                     app/api/agent/route.ts                           │
│                     runtime: nodejs                                   │
│                                                                      │
│  1. Validate request body  (messages[], model?)                      │
│  2. classifyRequest(lastUserMessage)  ← pure regex, zero LLM cost   │
│       greeting / help / unsupported  →  single { type:'message' }   │
│       claim_request  ↓                                               │
│  3. parseClaim(message, model)  ← generateText + JSON.parse + Zod   │
│       DeepSeek extracts fields only; makes no decisions              │
│  4. streamAssessmentWorkflow(parsedClaim)  ← AsyncGenerator          │
│       yields WorkflowEvent objects as each step runs                 │
│  5. Stream as text/event-stream                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│               lib/workflow/assessmentWorkflow.ts                     │
│                                                                      │
│  streamAssessmentWorkflow(claim)  AsyncGenerator<WorkflowEvent>      │
│    Uses ClaimDataManager exclusively — no direct tool/data imports   │
│                                                                      │
│  runAssessmentWorkflow(claim)  synchronous variant for tests         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│               lib/domain/ClaimDataManager.ts                         │
│                                                                      │
│  Single source of truth for all data access in the workflow          │
│  All tool results memoized — repeated calls return cached results    │
│                                                                      │
│  Policy:    lookupPolicy(), isPolicyActive(), getCoverage()          │
│             getMatchedExclusion(), getMatchedCoverageClause()        │
│             isClaimTypeExcluded(), checkExclusions()                 │
│  Documents: verifyDocument(id), verifyDocuments(), areAllDocsValid() │
│             getAllDocuments(), getMissingDocuments()                  │
│             getDocumentHealthSummary()                               │
│  Medical:   getMedicalNecessity(), isMedicallyNecessary()            │
│             hasUnapprovedProcedures(), getApprovedProcedures()       │
│  Benefit:   calculateBenefit()                                       │
│  Orchestration: runPrecheck() → PrecheckResult                       │
│                 runEligibilityGate() → EligibilityResult             │
│                 buildClaimContext() → ClaimContext                   │
│  Tool mgmt: peekNextCallId(), getLastToolCall()                      │
│             toolCalls (readonly), trace (readonly DataAccessLog[])   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│               lib/tools/   (pure functions, no side effects)         │
│  verifyDocument.ts          getDocumentById → valid/invalid/missing  │
│  lookupPolicy.ts            getPolicyById → Policy or not found      │
│  checkMedicalNecessity.ts   findNecessityRule → necessary + CPT sets │
│  calculateBenefit.ts        coverage% × (amount − deductible), cap  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│               lib/data/   (static in-memory seed data)               │
│  policies.ts      3 policies with coverageClauses + exclusions       │
│  documents.ts     6 documents, 1 missing (DOC-003)                   │
│  medicalCodes.ts  7 ICD-10 / plain-language necessity rules          │
│  claims.ts        3 reference test scenarios                         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│               DeepSeek API  (OpenAI-compatible)                      │
│  baseURL:  https://api.deepseek.com                                  │
│  models:   deepseek-chat (default) · deepseek-reasoner               │
│  SDK:      @ai-sdk/openai  →  generateText() only                    │
│  Role:     claim field extraction; no tool calls, no decisions       │
└──────────────────────────────────────────────────────────────────────┘
```

### LLM responsibility boundary

| Task | LLM | Application |
|---|---|---|
| Classify message (claim vs. greeting/help/unsupported) | | ✓ regex |
| Extract claim fields from natural language | ✓ | |
| Verify documents | | ✓ |
| Look up policy | | ✓ |
| Check medical necessity | | ✓ |
| Calculate benefit | | ✓ |
| Apply approval / rejection rules | | ✓ |
| Build assessment report | | ✓ |
| Orchestrate workflow | | ✓ |
| Emit SSE progress events | | ✓ generator |
| Handle non-claim messages | | ✓ static |

---

## Assessment Workflow

```
Claim submitted (natural language)
      │
      ▼
classifyRequest(message)    ← pure regex, zero LLM cost
  greeting / help / unsupported  →  static HELP_MESSAGE reply, stream closes
  claim_request  ↓
      │
      ▼
parseClaim(message, model)  ← DeepSeek (field extraction only)
  generateText() + JSON.parse() + ParsedClaimSchema.parse()
  → ParsedClaim { claimId, policyId, patientName, documentIds,
                  claimType, diagnosis, procedures, requestedAmount }
      │
      ▼
streamAssessmentWorkflow(parsedClaim)
      │
      ├─ [Step 1] Document Verification
      │   verifyDocument(id) for each documentId
      │   → ✓ valid / ✗ invalid / ✗ not found
      │   decision:  any document not valid  →  MORE_INFO_REQUIRED  (halt)
      │              all valid               →  continue
      │
      ├─ [Step 2] Policy Lookup
      │   lookupPolicy(policyId)
      │   → Policy or not found
      │   decision:  not found               →  REJECTED
      │              status ≠ "active"       →  REJECTED
      │              claimType in exclusions →  REJECTED  (cite clauseId EX-XX)
      │              no coverage for type    →  REJECTED
      │              active + not excluded + covered  →  continue
      │
      ├─ [Step 3] Medical Necessity
      │   checkMedicalNecessity(diagnosis, procedures)
      │   → necessary bool + rationale + approvedProcedures + unapprovedProcedures
      │   decision:  necessary = false       →  REJECTED
      │              necessary = true        →  continue
      │              (unapprovedProcedures tracked, surfaced in report and narration)
      │
      └─ [Step 4] Benefit Calculation  (only when Steps 1–3 all pass)
          calculateBenefit(policyId, claimType, requestedAmount)
          deductibleApplied = annualDeductibleMet ? 0 : coverage.deductible
          coveredAmount     = min((amount − deductible) × coveragePercent/100, maxBenefit)
          patientResponsibility = amount − coveredAmount
          decision:  calculation failure     →  REJECTED
                     success                →  APPROVED

Final output:
  recommendation   APPROVED | REJECTED | MORE_INFO_REQUIRED
  decisionMapping  one DecisionFactor per step: factor, status (PASS/FAIL), clauseId, explanation
  policyCitations  verbatim policy text with clauseId (EX-01, CV-02, …) and type
  reasoning        summary sentence + keyDrivers[]
  chatNarration    numbered 1–4 format for the chat window (PASS/FAIL per step + policy citation)
```

---

## Client-Side Streaming Pipeline

SSE events arrive at network speed. The UI reveals them at typewriter speed (~300 chars/sec), with panel updates synchronized to the exact character position where the motivating text becomes visible — not to when the event arrived.

```
SSE bytes arrive
  ReadableStream reader → TextDecoder → split on "\n\n" → WorkflowEvent[]
        │
        │  Per-event handling:
        │
        │  workflow-start   → enqueue text
        │  step-start       → scheduleEffect(markRunning) at current queue pos
        │                     enqueue step header text
        │  tool-start       → scheduleEffect(addRunningTool) when header visible
        │  tool-complete    → enqueue result line
        │                     scheduleEffect(setToolDone) after line visible
        │  step-result      → no-op (legacy; superseded by tool-start/complete)
        │  step-complete    → scheduleEffect(markStepCompleted)
        │  report-update    → scheduleEffect(mergePartialIntoReport)
        │  workflow-complete → enqueue final assessment block
        │  final-report     → scheduleEffect(replaceWithFullReport)
        │  error            → enqueue error message
        │
        ▼  enqueue(text)
           pendingRef.current   += text          (chars waiting to be revealed)
           totalEnqueuedRef.current += text.length
           if !typingActiveRef  →  start RAF loop
        │
        ▼  requestAnimationFrame tick (≤60 fps)
           reveal CHARS_PER_FRAME=5 chars from pendingRef → append to displayedRef
           fire scheduledEffects where fireAtPos ≤ displayedRef.length
             (WorkflowTimeline / ToolCallLog / AssessmentReport updates)
           setMessages([...base, { role:'assistant', content: displayedRef }])
```

### Ref inventory (`ChatContainer`)

| Ref | Type | Purpose |
|---|---|---|
| `pendingRef` | `string` | Characters queued but not yet revealed |
| `displayedRef` | `string` | All characters revealed so far (cumulative) |
| `totalEnqueuedRef` | `number` | Cumulative chars ever pushed to pending |
| `scheduledEffectsRef` | `ScheduledEffect[]` | `{fireAtPos, effect}` — fires when `displayedRef.length >= fireAtPos` |
| `baseMessagesRef` | `Message[]` | Conversation snapshot used as the base for the streaming slot |
| `rafIdRef` | `number \| null` | Active `requestAnimationFrame` handle |
| `typingActiveRef` | `boolean` | Guard preventing duplicate RAF loops |
| `abortRef` | `AbortController \| null` | Cancels in-flight fetch |

### State machine

```
sendMessage()
  IDLE → STREAMING (setIsStreaming(true))
    SSE events arrive → enqueue() + scheduleEffect()
    RAF loop drains pendingRef → fires effects at exact character positions
      WorkflowTimeline: PENDING → RUNNING → DONE
      ToolCallLog:      RUNNING → DONE
      AssessmentReport: sections appear section by section
    SSE closes (sseComplete = true)
      pendingRef empty → flush remaining effects → STREAMING → IDLE
      pendingRef non-empty → RAF continues → drains → flush → IDLE

abort() called at any point
  fetch throws AbortError → cancelTyping("Assessment cancelled.") → IDLE
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Node.js runtime) | 16.2.9 |
| UI library | React | 19.2.4 |
| Language | TypeScript (strict mode) | ^5 |
| Styling | Tailwind CSS | ^4 |
| LLM SDK | Vercel AI SDK | 6.0.203 |
| LLM provider | DeepSeek via `@ai-sdk/openai` | 3.0.71 |
| Schema validation | Zod | ^4.4.3 |
| Streaming | Server-Sent Events via `ReadableStream` | native |
| Testing | Vitest | ^4.1.8 |
| State persistence | `localStorage` (key: `claim-assessment-conversations-v3`) | — |

> `@ai-sdk/anthropic` (v3.0.84) is installed as a dependency. It is not wired to any route in the current codebase — Claude API support can be added without installing additional packages.

---

## Project Structure

```
claim-assessment-ai/
│
├── app/
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Root page → renders <ChatContainer />
│   └── api/
│       └── agent/
│           └── route.ts               # POST /api/agent → SSE stream of WorkflowEvents
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx          # Root state: conversations, SSE, animation queue
│   │   ├── ChatInput.tsx              # Textarea + quick-scenario buttons + abort/send
│   │   ├── MessageList.tsx            # Auto-scrolling message thread
│   │   ├── MessageBubble.tsx          # User / assistant message bubble
│   │   ├── WorkflowTimeline.tsx       # Step-progress strip (pending/running/done/failed)
│   │   └── ToolCallLog.tsx            # Live tool call panel with status transitions
│   ├── report/
│   │   ├── MultiClaimReportPanel.tsx  # Append-only ClaimEvent history + modal detail
│   │   ├── AssessmentReport.tsx       # 8-section report (accepts PartialAssessmentReport)
│   │   ├── ReportSection.tsx          # Collapsible accordion section
│   │   └── RecommendationBadge.tsx    # APPROVED / REJECTED / MORE INFO pill
│   └── sidebar/
│       └── Sidebar.tsx                # Dark conversation history (search, rename, delete)
│
├── lib/
│   ├── classifier/
│   │   └── requestClassifier.ts       # classifyRequest() — pure regex, zero LLM cost
│   ├── parser/
│   │   └── claimParser.ts             # parseClaim() — generateText + JSON.parse + Zod
│   ├── providers/
│   │   └── deepseek.ts                # createDeepSeekProvider() / getDeepSeekModel()
│   ├── domain/
│   │   └── ClaimDataManager.ts        # Memoized data access; wraps all four tools
│   ├── workflow/
│   │   └── assessmentWorkflow.ts      # streamAssessmentWorkflow() + runAssessmentWorkflow()
│   ├── tools/                         # Pure functions — no AI SDK wrappers
│   │   ├── verifyDocument.ts
│   │   ├── lookupPolicy.ts
│   │   ├── checkMedicalNecessity.ts
│   │   └── calculateBenefit.ts
│   └── data/                          # Static in-memory seed data
│       ├── policies.ts                # POLICIES + getPolicyById()
│       ├── documents.ts               # DOCUMENTS + getDocumentById() + getDocumentsByClaimId()
│       ├── medicalCodes.ts            # MEDICAL_NECESSITY_RULES + findNecessityRule()
│       └── claims.ts                  # CLAIMS + getClaimById()
│
├── types/
│   ├── agent.ts                       # ChatMessage, ToolCall, AgentState
│   ├── claims.ts                      # ClaimType (6), DocumentType (7), DocumentStatus (4),
│   │                                  # Document, Claim
│   ├── conversation.ts                # Conversation (localStorage persistence shape)
│   ├── policy.ts                      # Policy, Coverage, Exclusion (clauseId),
│   │                                  # CoverageClause, PolicyStatus
│   ├── report.ts                      # AssessmentReport, PartialAssessmentReport, ClaimEvent,
│   │                                  # DecisionFactor, PolicyCitation, ReasoningSection,
│   │                                  # DocumentFinding + per-section interfaces
│   └── workflow.ts                    # WorkflowToolCall, WorkflowEvent (11 variants)
│
└── __tests__/
    ├── scenario-a-approval.test.ts    # CLM-001 step-by-step; covered = $4,500
    ├── scenario-b-rejection.test.ts   # CLM-002 exclusion + not necessary
    ├── scenario-c-more-info.test.ts   # CLM-003 missing itemized bill
    ├── claim-flow.test.ts             # Full tool sequence; recommendation derivation
    ├── report.test.ts                 # runAssessmentWorkflow report structure + field values
    ├── report-citations.test.ts       # PolicyCitation correctness; no fabricated clauseIds
    ├── tool-execution.test.ts         # Edge cases: deductible math, cap, unknowns
    ├── request-classifier.test.ts     # 37 patterns across 4 categories
    └── provider-deepseek.test.ts      # Provider shape, model IDs (no API calls)
```

---

## Setup

### Prerequisites

- Node.js 18+
- DeepSeek API key — [platform.deepseek.com](https://platform.deepseek.com)

### Install

```bash
git clone <repo-url>
cd claim-assessment-ai
npm install
```

### Environment

```env
# .env.local
DEEPSEEK_API_KEY=your_key_here
```

### Run

```bash
npm run dev
# http://localhost:3000
```

### Test

```bash
npm test           # run all 9 suites once
npm run test:watch # watch mode
```

### Type-check and lint

```bash
npx tsc --noEmit
npm run lint
```

---

## API Reference

### `POST /api/agent`

The only API route. Streams a `text/event-stream` response.

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "Assess claim CLM-001 for John Doe..." }
  ],
  "model": "deepseek-chat"
}
```

`model` defaults to `"deepseek-chat"`. Accepted values: `"deepseek-chat"` · `"deepseek-reasoner"`. Unrecognised values fall back to `deepseek-chat`.

**Error responses** (JSON, before stream starts)

| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "messages array is required and must not be empty" }` | Missing or empty `messages` |
| 400 | `{ "error": "Invalid JSON body" }` | Malformed request |
| 400 | `{ "error": "No user message found in history" }` | No `role:"user"` in messages |

**SSE stream** — one JSON object per `data:` line, terminated by `\n\n`

| Event | Key fields | When emitted |
|---|---|---|
| `workflow-start` | `claimId` | Workflow begins |
| `step-start` | `step`, `stepName` | Before each step |
| `tool-start` | `toolCallId`, `toolName`, `input`, `step` | Before tool executes |
| `tool-complete` | `toolCall`, `line`, `step` | After tool returns |
| `step-result` | `toolCall`, `line` | Same timing as `tool-complete`; legacy |
| `step-complete` | `step`, `stepName`, `summary` | Step finishes |
| `report-update` | `partial: PartialAssessmentReport`, `step`, `stepName` | After each step; also after decision |
| `workflow-complete` | `recommendation`, `reasoning` | Decision reached; before Step 4 |
| `final-report` | `report: AssessmentReport`, `toolCalls`, `summary` | All steps done |
| `error` | `message` | Unhandled exception |
| `message` | `messageClass`, `summary` | Non-claim input (greeting / help / unsupported) |

---

## Data Model

### `AssessmentReport` (`types/report.ts`)

```typescript
interface AssessmentReport {
  claimId: string;
  patientName: string;
  assessmentDate: string;       // ISO date (YYYY-MM-DD)
  recommendation: 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUIRED';
  sections: {
    documentReview:     { summary: string; findings: DocumentFinding[] };
    policyVerification: { summary: string; policyId: string; holderName: string;
                          status: string; coverageDetails: Record<string, unknown> };
    medicalNecessity:   { summary: string; necessary: boolean;
                          rationale: string; codes?: string[] };
    benefitCalculation: { summary: string; requestedAmount: number;
                          coveredAmount: number; patientResponsibility: number;
                          deductibleApplied: number };
    recommendation:     { decision: Recommendation; reasoning: string };
    policyCitations:    PolicyCitation[];   // clauseId, type, section, text
    decisionMapping:    DecisionFactor[];   // factor, status (PASS/FAIL), clauseId, explanation
    reasoning:          { summary: string; keyDrivers: string[] };
  };
}
```

`PartialAssessmentReport` is identical but all `sections` fields are optional — it grows via `report-update` events.

`ClaimEvent` is the `localStorage` unit: `{ eventId: UUID, claimId, timestamp, report: PartialAssessmentReport }`. UUID key (not `claimId`) means the same claim can be re-assessed without overwriting prior results.

### `Policy` (`types/policy.ts`)

```typescript
interface Policy {
  policyId: string;
  holderName: string;
  effectiveDate: string;            // ISO date
  expirationDate: string;           // ISO date
  status: 'active' | 'inactive' | 'suspended';
  coverages: Coverage[];            // claimType, coveragePercent, maxBenefit, deductible, requiresPreAuth
  exclusions: Exclusion[];          // clauseId (e.g. EX-01), description, claimTypes[], icdCodes?
  coverageClauses: CoverageClause[];// clauseId (e.g. CV-02), claimType, type, description
  annualDeductibleMet: boolean;
  notes?: string;
}
```

---

## Tool Contracts

All four tools are pure functions. `ClaimDataManager` wraps each one, memoizes results, and appends to `toolCalls[]`.

| Tool | Input | Returns |
|---|---|---|
| `verifyDocument` | `{ documentId }` | `{ success:true, valid, documentType, provider, issuedDate, issues[] }` or `{ success:false, error }` |
| `lookupPolicy` | `{ policyId }` | `{ success:true, policy: Policy }` or `{ success:false, error }` |
| `checkMedicalNecessity` | `{ diagnosis, procedures[] }` | `{ necessary, rationale, approvedProcedures[], requestedProcedures[], unapprovedProcedures[] }` |
| `calculateBenefit` | `{ policyId, claimType, amount }` | `{ success:true, coveredAmount, patientResponsibility, deductibleApplied, coveragePercent, details }` or `{ success:false, error }` |

`calculateBenefit` arithmetic:

```
deductibleApplied    = annualDeductibleMet ? 0 : coverage.deductible
amountAfterDeductible = max(0, amount − deductibleApplied)
rawCovered           = amountAfterDeductible × (coveragePercent / 100)
coveredAmount        = min(rawCovered, maxBenefit)
patientResponsibility = amount − coveredAmount
```

---

## Seed Data

### Policies

| ID | Holder | Annual deductible | Key coverage clauses |
|---|---|---|---|
| POL-001 | John Doe | Met | Surgery 90%/\$30k (CV-02), Hospitalization 90%/\$50k (CV-01), Emergency 100%/\$10k (CV-03) |
| POL-002 | Jane Smith | Not met | Elective excluded (EX-01), Hospitalization 80%/\$40k (CV-04), Outpatient 70%/\$5k (CV-05) |
| POL-003 | Bob Johnson | Not met | Surgery 85%/\$25k (CV-07), Hospitalization 85%/\$45k (CV-06); itemized bill required |

All three policies have `status: 'active'`.

### Documents

| ID | Claim | Type | Status |
|---|---|---|---|
| DOC-001 | CLM-001 | discharge_summary | valid |
| DOC-002 | CLM-001 | itemized_bill | valid |
| DOC-004 | CLM-002 | medical_bill | valid |
| DOC-005 | CLM-002 | referral | valid |
| DOC-006 | CLM-003 | discharge_summary | valid |
| DOC-003 | CLM-003 | itemized_bill | **missing** |

### Medical necessity rules

7 rules covering: `K37`, `appendicitis`, `Z41.1`, `elective cosmetic surgery`, `cosmetic`, `S72.001A`, `fracture`.

Matching: case-insensitive substring — `diagnosis.includes(rule.diagnosis)` OR `rule.diagnosis.includes(diagnosis)`. More specific ICD codes appear before plain-language entries to prefer precise matches.

---

## Test Scenarios

| Scenario | Claim | Policy | Diagnosis | Outcome | Blocking factor |
|---|---|---|---|---|---|
| A — Approval | CLM-001 (John Doe) | POL-001 | appendicitis (K37) | **APPROVED** | None — \$4,500 covered (90% × \$5,000, deductible met) |
| B — Rejection | CLM-002 (Jane Smith) | POL-002 | elective cosmetic surgery (Z41.1) | **REJECTED** | Exclusion EX-01 |
| C — More Info | CLM-003 (Bob Johnson) | POL-003 | femoral fracture (S72.001A) | **MORE\_INFO\_REQUIRED** | DOC-003 itemized bill missing |

All three scenarios are available as quick-submit pill buttons in the chat input.

---

## Test Coverage

9 suites, run with `npm test`.

| Suite | What is verified |
|---|---|
| `scenario-a-approval` | CLM-001 each tool step; covered = \$4,500; `deductibleApplied` = \$0 |
| `scenario-b-rejection` | CLM-002 exclusion presence; `necessary` = false; `calculateBenefit` returns excluded error |
| `scenario-c-more-info` | CLM-003 DOC-003 `valid` = false; POL-003 surgery 85%; hypothetical benefit = \$9,562.50 |
| `claim-flow` | Full tool sequence for all 3 scenarios; derived recommendation matches expected |
| `report` | `runAssessmentWorkflow` report shape, field values, tool call log order and statuses |
| `report-citations` | `policyCitations` correct clauseIds; no fabricated text; financial figures round-trip |
| `tool-execution` | Edge cases: unknown IDs, deductible math, maxBenefit cap, unapproved procedures |
| `request-classifier` | 37 patterns: claim_request (10), greeting (14), help_request (8), unsupported (5) |
| `provider-deepseek` | Provider shape, baseURL constant, model IDs, no API calls made |

---

## License

Internal use — Papaya Insurtech.
