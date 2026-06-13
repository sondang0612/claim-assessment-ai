# Changelog

## 2026-06-13 — Streaming Workflow via SSE

### Feature — Real-time workflow progress streaming

**Architecture change:**
Previously the API route awaited the full `runAssessmentWorkflow` result then returned it as a single JSON blob.  Users saw no output until the entire assessment finished.  The API route now streams Server-Sent Events (SSE) as each workflow step completes, and the frontend renders them incrementally in the assistant message bubble.

**Added**
- `types/workflow.ts` — `WorkflowToolCall` (moved from `assessmentWorkflow.ts`) and `WorkflowEvent` discriminated union
  - Event types: `workflow-start`, `step-start`, `step-result`, `step-complete`, `workflow-complete`, `final-report`, `error`, `message`
- `lib/workflow/assessmentWorkflow.ts` — `streamAssessmentWorkflow(claim)` async generator; yields `WorkflowEvent` objects as each step executes; same deterministic business logic as `runAssessmentWorkflow`

**Changed**
- `app/api/agent/route.ts` — converted from `Response.json()` to SSE `ReadableStream` (`Content-Type: text/event-stream`); claim requests consume `streamAssessmentWorkflow` and forward events; non-claim messages emit a single `message` event; validation errors (400) still return JSON
- `components/chat/ChatContainer.tsx` — replaced `await res.json()` with SSE `ReadableStream` reader; parses `data:` lines and handles each `WorkflowEvent`; builds assistant message content incrementally via `appendContent`/`updateContent`; tool calls appear in `ToolCallLog` as each `step-result` event arrives; `final-report` event populates the right-panel report view

**Preserved**
- `runAssessmentWorkflow` synchronous function — unchanged; all 122 existing tests continue to pass
- Deterministic architecture — LLM limited to claim parsing; all business logic in TypeScript

**User experience**
```
Assessment started for claim CLM-001.

## Step 1: Document Verification
✓ DOC-001 verified
✓ DOC-002 verified

## Step 2: Policy Verification
✓ Policy active
✓ surgery coverage found

## Step 3: Medical Necessity
✓ Procedure medically necessary

## Step 4: Benefit Calculation
✓ Covered amount: $4,500

---

## Final Assessment

APPROVED
All criteria satisfied. Benefit: $4,500 covered at 90% (deductible $0 applied).
```

**Verified**
- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 122/122 tests passing (9 test files)
- `npx eslint` — 0 errors (2 pre-existing warnings in ChatInput.tsx)
- `npm run build` — compiled successfully

---

## 2026-06-13 — Request Classification Layer

### Added — Non-claim message handling

**Added**
- `lib/classifier/requestClassifier.ts` — `classifyRequest(message)` returns `MessageClass` (`claim_request | greeting | help_request | unsupported`) using pure regex matching — no LLM call, zero latency
- `HELP_MESSAGE` constant — static onboarding response for all non-claim messages
- `__tests__/request-classifier.test.ts` — 37 tests covering all 4 categories, priority rules, and edge cases

**Changed**
- `app/api/agent/route.ts` — classifies message before any LLM call; returns `{ messageClass, summary: HELP_MESSAGE }` for non-claim messages; includes `messageClass` in claim response
- `components/chat/ChatContainer.tsx` — added `messageClass` field to `AgentResponse` type

**Behavior**
- Greetings ("hi", "hello", "xin chào", "how are you?"), help requests ("help", "how does this work?"), and unrecognized messages now receive a structured onboarding response without making any API call
- Messages containing CLM-/POL-/DOC- identifiers or medical terms + financial amounts/codes proceed to claim parsing as before

**Verified**
- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 122/122 tests passing (9 test files)
- `npx eslint` — 0 errors (2 pre-existing warnings in ChatInput.tsx unrelated to refactor)

---

## 2026-06-13 — Application-Driven Workflow Refactor

### Refactor — LLM-driven → deterministic application workflow

**Architecture change:**
Previously the LLM received a system prompt instructing it to call tools in sequence, make business decisions, and emit a `<report>` JSON block in its response text. The API streamed SSE events to the client. Now the LLM only extracts structured claim fields; all business logic runs in deterministic TypeScript.

**Added**
- `lib/parser/claimParser.ts` — `parseClaim(userMessage, model)` using `generateText` + `JSON.parse` + `ParsedClaimSchema.parse` (avoids DeepSeek's unsupported `json_schema` response_format)
- `lib/workflow/assessmentWorkflow.ts` — `runAssessmentWorkflow(claim)` — deterministic 4-step workflow, TypeScript decision rules, in-code report builder

**Removed**
- `lib/agent/agent.ts` — `streamText`-based ReAct tool loop
- `lib/agent/prompts.ts` — system prompt with embedded workflow instructions
- `lib/agent/tools.ts` — AI SDK v6 tool wrappers
- `lib/report/generateReport.ts` — `parseReportFromText()` (report now built in code)

**Changed**
- `app/api/agent/route.ts` — replaced SSE stream with `Response.json({ report, toolCalls, summary })`
- `components/chat/ChatContainer.tsx` — replaced SSE reader with standard JSON fetch + `AbortController`
- `__tests__/report.test.ts` — rewritten to test `runAssessmentWorkflow` for all 3 scenarios (11 tests)
- `__tests__/report-citations.test.ts` — rewritten to use workflow citation output (9 tests)
- `__tests__/claim-flow.test.ts` — updated reference comment from deleted `prompts.ts`

**Verified**
- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 85/85 tests passing
- `npx eslint` — 0 errors (2 pre-existing warnings in ChatInput.tsx unrelated to refactor)

---

## 2026-06-13

### Added — UI (Phase 5)

**API Route** (`app/api/agent/route.ts`) — UPDATED
- Replaced `toTextStreamResponse()` with custom SSE stream from `fullStream`
- Emits `{ type:'text', text }`, `{ type:'tool-call', toolCallId, toolName, input }`,
  `{ type:'tool-result', toolCallId, toolName, output }`, `data: [DONE]` events
- Error events emitted on stream failure

**Chat Components** (`components/chat/`) — NEW
- `ChatContainer.tsx` — state orchestrator; SSE client; holds messages, toolCalls, report, model
- `MessageList.tsx` — scrollable message thread with auto-scroll; empty state
- `MessageBubble.tsx` — user (blue, right) / assistant (white border, left) bubble with streaming cursor
- `ChatInput.tsx` — textarea + model selector + Send/Stop button + 3 scenario quick-start buttons
- `ToolCallLog.tsx` — collapsible panel showing each tool call status (calling/done/error) + expandable result JSON

**Report Components** (`components/report/`) — NEW
- `AssessmentReport.tsx` — full 6-section report: DocumentReview, PolicyVerification, MedicalNecessity, BenefitCalculation, Recommendation, PolicyCitations
- `ReportSection.tsx` — collapsible section wrapper with title + icon
- `RecommendationBadge.tsx` — color-coded badge: green (APPROVED), red (REJECTED), yellow (MORE_INFO_REQUIRED)

**Page** (`app/page.tsx`) — UPDATED
- Replaced Next.js boilerplate with `<ChatContainer />`

**Layout** (`app/layout.tsx`) — UPDATED
- Updated metadata title and description

### Verified
- `npm run build` — 0 errors (TypeScript + Turbopack)
- `npm run lint` — 0 errors, 0 warnings

---

## 2026-06-12

### Migration — Anthropic Claude → DeepSeek

**Provider** (`lib/providers/deepseek.ts`) — NEW
- `createDeepSeekProvider(apiKey?)` — factory using `@ai-sdk/openai` with `baseURL: https://api.deepseek.com`
- `getDeepSeekModel(model)` — returns `LanguageModelV3` via `.chat()` (OpenAI chat completions endpoint)
- `DeepSeekModel` type: `'deepseek-chat' | 'deepseek-reasoner'`
- `DEFAULT_MODEL = 'deepseek-chat'`

**Agent** (`lib/agent/agent.ts`) — UPDATED
- Removed `@ai-sdk/anthropic` import
- Replaced `anthropic('claude-sonnet-4-6')` with `getDeepSeekModel(model)`
- Added `model: DeepSeekModel` parameter to `runAgent()` (defaults to `deepseek-chat`)
- Added model name to `onStepFinish` log output

**API Route** (`app/api/agent/route.ts`) — UPDATED
- Accepts optional `"model"` field in POST body (`deepseek-chat` | `deepseek-reasoner`)
- Validates model against allowlist; falls back to `DEFAULT_MODEL` if invalid/absent

**Installed**
- `@ai-sdk/openai@3.0.71` — OpenAI-compatible provider SDK

### Added — Tests (4 new files, 51 new tests)

- `provider-deepseek.test.ts` (11) — Provider config, model selection, LanguageModelV3 shape validation
- `claim-flow.test.ts` (14) — End-to-end workflow for all 3 scenarios with `deriveRecommendation` helper
- `tool-execution.test.ts` (21) — Tool edge cases: unknown IDs, deductible math, maxBenefit cap, unapproved procedures, empty deductible
- `report-citations.test.ts` (9) — Report round-trip fidelity, policy citation source text validation, multi-citation ordering

### Verified
- `npx tsc --noEmit` — 0 errors (strict mode)
- `npx vitest run` — 77/77 tests passing across 8 test files

---

### Added — Domain Layer (earlier in session)

**Types** (`types/`)
- `agent.ts`, `claims.ts`, `policy.ts`, `report.ts`

**Mock Data** (`lib/data/`)
- `policies.ts`, `documents.ts`, `medicalCodes.ts`, `claims.ts`

**Tool Implementations** (`lib/tools/`)
- `lookupPolicy.ts`, `calculateBenefit.ts`, `verifyDocument.ts`, `checkMedicalNecessity.ts`

### Added — Agent Core (earlier in session)

- `lib/agent/prompts.ts` — workflow-enforcing system prompt + `<report>` format
- `lib/agent/tools.ts` — AI SDK v6 `inputSchema`-based tool definitions
- `lib/report/generateReport.ts` — `parseReportFromText()`
- `app/api/agent/route.ts` — streaming POST endpoint

### Fixed — AI SDK v6 Compatibility (earlier in session)
- `parameters` → `inputSchema`
- `maxSteps` → `stopWhen: stepCountIs(N)`
- `toDataStreamResponse()` → `toTextStreamResponse()`
- `call.args` → `call.toolName` in `onStepFinish`
