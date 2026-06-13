# Project State

## Status: Complete — Synchronized Progressive Rendering (ChatGPT Agent-style UX)

---

## Completed

- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (AGENTS.md)
- Architecture design (SYSTEM_MAP.md)
- Folder structure definition + implementation plan
- **T1** — TypeScript type definitions (`types/`)
- **T2** — Mock data layer (`lib/data/`)
- **T3** — 4 tool function implementations (`lib/tools/`)
- **T4** — AI SDK v6 tool schemas (`lib/agent/tools.ts`) *(removed in refactor)*
- **T5** — System prompt with workflow + report format (`lib/agent/prompts.ts`) *(removed in refactor)*
- **T6** — Agent runner with streaming + tool logging (`lib/agent/agent.ts`) *(removed in refactor)*
- **T7** — Streaming API route — custom SSE from `fullStream` *(replaced with JSON route, then re-introduced as SSE in T16)*
- **T8** — Report parser (`lib/report/generateReport.ts`) *(removed in refactor)*
- **Migration** — Anthropic → DeepSeek provider (`lib/providers/deepseek.ts`)
- **T9** — Chat components (`components/chat/`)
- **T10** — Report components (`components/report/`)
- **T11** — Page integration (`app/page.tsx`)
- **T12** — All test scenarios (122 tests, 9 files, all passing)
- **T13** — TypeScript + ESLint + Build all clean (0 errors)
- **T14** — Refactor: LLM-driven → application-driven workflow
  - `lib/parser/claimParser.ts` — LLM extracts structured claim fields only
  - `lib/workflow/assessmentWorkflow.ts` — deterministic 4-step workflow
  - Deleted `lib/agent/` (agent.ts, prompts.ts, tools.ts)
  - Deleted `lib/report/generateReport.ts`
  - Updated API route to return JSON (not SSE stream)
  - Updated ChatContainer to use JSON fetch (not SSE reader)
- **T15** — Request classification layer
  - `lib/classifier/requestClassifier.ts` — pure regex classifier (no LLM)
  - classifies: `claim_request | greeting | help_request | unsupported`
  - Non-claim messages return static HELP_MESSAGE — zero LLM cost
  - API route gates LLM/workflow calls behind `claim_request` check
- **T16** — Streaming workflow via SSE
  - `types/workflow.ts` — `WorkflowToolCall` + `WorkflowEvent` discriminated union (8 event types)
  - `lib/workflow/assessmentWorkflow.ts` — added `streamAssessmentWorkflow` async generator
  - `app/api/agent/route.ts` — converted to SSE (`text/event-stream`); forwards generator events
  - `components/chat/ChatContainer.tsx` — SSE `ReadableStream` reader; incremental content build
- **T17** — Progressive typing renderer (ChatGPT-style UX)
  - `components/chat/ChatContainer.tsx` — typing queue architecture:
    - `pendingRef` — text buffer fed by SSE events (not yet displayed)
    - `displayedRef` — text currently shown in the assistant bubble
    - `baseMessagesRef` — history snapshot the RAF loop builds messages on
    - `rafIdRef` / `typingActiveRef` — RAF lifecycle guards
    - `CHARS_PER_FRAME = 5` → ~300 chars/sec at 60 fps
    - SSE consumer calls `enqueue(text)` — non-blocking, never awaits the RAF
    - RAF `tick()` drains the queue N chars/frame, calls `setMessages` once/frame
    - `sseComplete` `let` variable closed over by `tick` — loop calls `setIsStreaming(false)` when both queue is empty AND SSE stream has closed
    - Abort path: `cancelTyping(finalText)` cancels RAF and flushes final text immediately
    - Error path: same — RAF cancelled, error message surfaced, `isStreaming` cleared
- **T18** — Live tool lifecycle events + progressive report rendering
  - `types/workflow.ts` — added `tool-start`, `tool-complete`, `report-update` event types; `WorkflowToolCall.status` extended to `'done' | 'running' | 'completed' | 'failed'`
  - `types/report.ts` — added `PartialAssessmentSections` (all sections optional) and `PartialAssessmentReport` interface
  - `lib/workflow/assessmentWorkflow.ts` — `streamAssessmentWorkflow` now emits:
    - `tool-start` before each tool call (carries toolCallId, toolName, input)
    - `tool-complete` after each tool call (carries result + human-readable line)
    - `report-update` after each step-complete with the partial sections available so far
    - `report-update` after `workflow-complete` with recommendation + reasoning section
    - `docFindings` computed right after Step 1; `policyCitations` right after Step 2
    - Non-approved claims receive an immediate N/A `benefitCalculation` section (no "Pending…" flash)
  - `components/chat/ToolCallLog.tsx` — extended status union; `running` → yellow pulse, `completed` → green dot
  - `components/report/AssessmentReport.tsx` — accepts `PartialAssessmentReport`; each section wrapped in conditional; missing sections show animated "Pending…" placeholder
  - `components/chat/WorkflowTimeline.tsx` — new component; horizontal step tracker with pending/running/completed/failed states
- **T19** — Synchronized side-effect queue (UX race condition fix)
  - Root cause: SSE events arrived at network speed while narration typed at ~300 chars/sec; tool panels and full report appeared before the corresponding text was visible
  - Fix: `scheduledEffectsRef` (list of `{ fireAtPos, effect }`) + `totalEnqueuedRef` (cumulative chars ever enqueued)
  - `scheduleEffect(fn)` registers a callback at the CURRENT `totalEnqueuedRef` position
  - RAF `tick()` after each char reveal checks `displayedRef.length >= fireAtPos`; fires all due effects in insertion order
  - Ordering discipline:
    - `step-start` → `scheduleEffect(markRunning)` THEN `enqueue(header)` → step fires RUNNING when prior text finishes
    - `tool-start` → `scheduleEffect(addRunning)` → tool appears RUNNING when step header finishes typing
    - `tool-complete` → `enqueue(line)` THEN `scheduleEffect(setDone)` → tool turns DONE after its result line is fully typed
    - `step-complete` → `scheduleEffect(markCompleted)` → step turns DONE at same position as last tool's completion
    - `report-update` → `scheduleEffect(mergeSection)` → section appears in right panel at same moment
    - `final-report` → `scheduleEffect(setFullReport)` → complete report replaces partials after all text typed
  - Safety flush: when SSE closes with queue already empty, any remaining effects fire immediately before `setIsStreaming(false)`

---

## In Progress

- (nothing)

---

## Todo

- (nothing)

---

## Environment Variables

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

Set in `.env.local` for local development. Required at runtime; not needed to run tests.

---

## AI Provider — DeepSeek via @ai-sdk/openai

| Setting | Value |
|---|---|
| Package | `@ai-sdk/openai@3.0.71` |
| Base URL | `https://api.deepseek.com` |
| Default model | `deepseek-chat` |
| Reasoning model | `deepseek-reasoner` |
| Endpoint used | `.chat()` → `/v1/chat/completions` |
| AI SDK usage | `generateText()` only (no `streamText`, no tool calls) |

### Model selection

The API route accepts an optional `model` field in the request body:

```json
{ "messages": [...], "model": "deepseek-reasoner" }
```

Defaults to `deepseek-chat` if omitted or invalid. The model is passed to `parseClaim()` only.

---

## Installed Dependencies

```
ai@6.0.203             Vercel AI SDK (generateText, generateObject)
@ai-sdk/openai@3.0.71  OpenAI-compatible provider → used for DeepSeek
zod@4.4.3              Schema validation for ParsedClaimSchema
vitest@4.1.8           Test runner
```

---

## Architecture — Streaming Application-Driven Workflow

```
POST /api/agent  { messages, model? }
    ↓ parseClaim(lastUserMessage, model)
lib/parser/claimParser.ts
    → generateText(system=PARSER_SYSTEM, prompt=userMessage)
    → JSON.parse(text) + ParsedClaimSchema.parse()
    ↓ ParsedClaim
    ↓ streamAssessmentWorkflow(parsedClaim)       ← async generator
lib/workflow/assessmentWorkflow.ts
    → yield workflow-start
    → verifyDocument() × N  → yield step-result (each doc)
    → yield step-complete (doc step)
    → lookupPolicy()        → yield step-result
    → yield step-complete (policy step)
    → checkMedicalNecessity() → yield step-result
    → yield step-complete (necessity step)
    → decision rules in TypeScript → yield workflow-complete
    → calculateBenefit() (if APPROVED) → yield step-result
    → builds AssessmentReport in code
    → yield final-report
app/api/agent/route.ts
    → ReadableStream (text/event-stream)
    → forward each WorkflowEvent as  data: <json>\n\n
```

### LLM Responsibility

- **Only**: extract structured claim fields (claimId, policyId, documentIds, claimType, diagnosis, procedures, requestedAmount) from a natural language user message.
- **Not**: tool calling, business decisions, workflow orchestration, report generation.

### Application Responsibility

- Execute all 4 domain tools deterministically in fixed sequence.
- Apply all business rules (document validity, policy exclusions, medical necessity, benefit calculation) in TypeScript.
- Build the full `AssessmentReport` in code.
- Emit `WorkflowEvent` objects incrementally via async generator.

---

## WorkflowEvent Types

| Event | Emitted when | Payload | Frontend action |
|---|---|---|---|
| `workflow-start` | Generator starts | `claimId` | `enqueue("Assessment started…")` |
| `step-start` | Step begins | `step`, `stepName` | `scheduleEffect(markRunning)` → `enqueue(header)` |
| `tool-start` | Before each tool call | `toolCallId`, `toolName`, `input`, `step` | `scheduleEffect(addRunningTool)` |
| `tool-complete` | After each tool call | `toolCall` (status=completed), `line`, `step` | `enqueue(line)` → `scheduleEffect(setDone)` |
| `step-result` | After each tool (legacy) | `toolCall`, `line` | ignored (handled by tool-start/tool-complete) |
| `step-complete` | All tools in step done | `step`, `stepName`, `summary` | `scheduleEffect(markCompleted)` |
| `report-update` | After step-complete | `partial: PartialAssessmentReport`, `step`, `stepName` | `scheduleEffect(mergeReport)` |
| `workflow-complete` | Decision rules applied | `recommendation`, `reasoning` | `enqueue(finalText)` |
| `final-report` | Full report built | `report`, `toolCalls`, `summary` | `scheduleEffect(setFullReport)` |
| `error` | Exception in workflow | `message` | `enqueue(errorText)` |
| `message` | Non-claim input | `messageClass`, `summary` | `enqueue(summary)` |

---

## API Contract

```
POST /api/agent
Body: { messages: ChatMessage[], model?: "deepseek-chat" | "deepseek-reasoner" }

Response 200 — SSE stream (text/event-stream):
  Claim request: stream of WorkflowEvent objects
    data: {"type":"workflow-start","claimId":"CLM-001"}
    data: {"type":"step-start","step":1,"stepName":"Document Verification"}
    data: {"type":"step-result","toolCall":{...},"line":"✓ DOC-001 verified"}
    ...
    data: {"type":"final-report","report":{...},"toolCalls":[...],"summary":"..."}

  Non-claim: single message event
    data: {"type":"message","messageClass":"greeting","summary":"..."}

Response 400: JSON { error: string }  (validation errors before stream starts)
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI provider | DeepSeek via `@ai-sdk/openai` | OpenAI-compatible API; no separate SDK needed |
| LLM call | `generateText()` | DeepSeek rejects `json_schema` response_format used by `generateObject()` |
| JSON extraction | `JSON.parse + Zod.parse` | Safe validation after `generateText()` plain text response |
| Workflow | Deterministic TypeScript | No hallucination risk; fully testable without API |
| Streaming | AsyncGenerator + SSE | Events emitted per step; deterministic execution preserved |
| Report building | In-code TypeScript | Deterministic output; policy citations from structured data |
| Backward compat | `runAssessmentWorkflow` kept sync | All 122 existing tests pass unchanged |
| Tool calls | Plain TypeScript functions | No AI SDK wrappers needed in application-driven flow |
| Message classification | Regex (no LLM) | Zero latency; prevents parser errors for casual messages |

---

## Test Results

```
Test Files: 9 passed
Tests:      122 passed
```

| File | Tests | Coverage |
|---|---|---|
| `scenario-a-approval.test.ts` | 5 | CLM-001 — docs valid, POL-001, appendicitis → APPROVED |
| `scenario-b-rejection.test.ts` | 5 | CLM-002 — elective excluded, not necessary → REJECTED |
| `scenario-c-more-info.test.ts` | 6 | CLM-003 — missing itemized bill → MORE_INFO_REQUIRED |
| `report.test.ts` | 11 | runAssessmentWorkflow — all 3 scenarios, report structure |
| `provider-deepseek.test.ts` | 11 | DeepSeek provider config, model selection, LanguageModelV3 shape |
| `claim-flow.test.ts` | 14 | End-to-end tool chain for all 3 scenarios + recommendation derivation |
| `tool-execution.test.ts` | 21 | Edge cases: unknown IDs, deductible math, maxBenefit cap, unapproved procedures |
| `report-citations.test.ts` | 9 | Workflow citation output + citation source data validation |
| `request-classifier.test.ts` | 37 | All 4 categories + priority rules (claim wins over greeting) + edge cases |
