# System Map

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Next.js App)                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Presentation Layer                                   │  │
│  │  app/page.tsx                                        │  │
│  │  ├─ components/chat/ChatContainer.tsx                │  │
│  │  │   ├─ MessageList.tsx  (user + assistant messages) │  │
│  │  │   ├─ MessageBubble.tsx (individual message)       │  │
│  │  │   ├─ ChatInput.tsx    (text input + send)         │  │
│  │  │   └─ ToolCallLog.tsx  (tool call trace panel)     │  │
│  │  └─ components/report/AssessmentReport.tsx           │  │
│  │      ├─ ReportSection.tsx (collapsible section)      │  │
│  │      └─ RecommendationBadge.tsx (APPROVED/…)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                     │ POST /api/agent → SSE stream           │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Layer                                            │  │
│  │  app/api/agent/route.ts  ← POST → SSE stream         │  │
│  │  ReadableStream (text/event-stream)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Classifier Layer  (deterministic — no LLM)          │  │
│  │  lib/classifier/requestClassifier.ts                 │  │
│  │  ├─ classifyRequest(message) → MessageClass          │  │
│  │  ├─ claim_request / greeting / help_request /        │  │
│  │  │   unsupported                                     │  │
│  │  └─ Pure regex matching — zero latency, no API call  │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │ claim_request only                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Parser Layer  (LLM — structured extraction only)     │  │
│  │  lib/parser/claimParser.ts                           │  │
│  │  ├─ parseClaim(userMessage, model) → ParsedClaim     │  │
│  │  ├─ Uses generateText() + JSON.parse + Zod           │  │
│  │  └─ No tool calls, no decisions, no orchestration    │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Workflow Layer  (deterministic — async generator)    │  │
│  │  lib/workflow/assessmentWorkflow.ts                  │  │
│  │  ├─ streamAssessmentWorkflow(claim)                  │  │
│  │  │   AsyncGenerator<WorkflowEvent>                  │  │
│  │  ├─ yield workflow-start                             │  │
│  │  ├─ Step 1: verifyDocument() × N → yield step-result │  │
│  │  ├─ Step 2: lookupPolicy()      → yield step-result  │  │
│  │  ├─ Step 3: checkMedicalNecessity() → yield step-result│ │
│  │  ├─ Decision rules in TypeScript → yield workflow-complete│
│  │  ├─ Step 4: calculateBenefit() (APPROVED only)      │  │
│  │  ├─ Builds AssessmentReport in code                 │  │
│  │  └─ yield final-report                              │  │
│  │                                                      │  │
│  │  ├─ runAssessmentWorkflow(claim) → WorkflowResult   │  │
│  │  │   (synchronous; kept for test compatibility)     │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Provider Layer                                       │  │
│  │  lib/providers/deepseek.ts                           │  │
│  │  ├─ createDeepSeekProvider(apiKey?)                  │  │
│  │  │   → createOpenAI({ name, baseURL, apiKey })       │  │
│  │  └─ getDeepSeekModel(model)                         │  │
│  │       → provider.chat('deepseek-chat' | '…reasoner') │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Layer  (pure functions — no AI SDK wrappers)    │  │
│  │  lib/tools/lookupPolicy.ts                           │  │
│  │  lib/tools/calculateBenefit.ts                       │  │
│  │  lib/tools/verifyDocument.ts                         │  │
│  │  lib/tools/checkMedicalNecessity.ts                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Layer (in-memory mock)                          │  │
│  │  lib/data/policies.ts     ← 3 mock policies          │  │
│  │  lib/data/documents.ts    ← mock documents per claim │  │
│  │  lib/data/medicalCodes.ts ← ICD/CPT necessity rules  │  │
│  │  lib/data/claims.ts       ← 3 test scenario claims   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Type Layer                                           │  │
│  │  types/agent.ts      ← ChatMessage, ToolCall         │  │
│  │  types/claims.ts     ← Claim, ClaimType, Document    │  │
│  │  types/policy.ts     ← Policy, Coverage, Exclusion   │  │
│  │  types/report.ts     ← AssessmentReport, Recommendation│ │
│  │  types/workflow.ts   ← WorkflowToolCall, WorkflowEvent│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│      DeepSeek API  (OpenAI-compatible chat completions)      │
│      baseURL: https://api.deepseek.com                       │
│      Auth:    DEEPSEEK_API_KEY                               │
│      Models:  deepseek-chat (default) · deepseek-reasoner    │
│      SDK:     @ai-sdk/openai  → generateText() only          │
│      Role:    claim field extraction (no tool calls)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Flow (Streaming Application-Driven)

```
User submits any message
        │
        ▼
POST /api/agent  { messages, model? }
        │
        ▼  classifyRequest(lastUserMessage)      ← pure regex, no LLM
lib/classifier/requestClassifier.ts
        │
        ├─ greeting / help_request / unsupported
        │       ↓ SSE: single { type:'message', summary } event then close
        │
        └─ claim_request
                ▼
        parseClaim(lastUserMessage, model)
lib/parser/claimParser.ts
        │  generateText(system=PARSER_SYSTEM, prompt=userMessage)
        │  → DeepSeek returns raw JSON string
        │  → JSON.parse() + ParsedClaimSchema.parse()
        ▼  ParsedClaim { claimId, policyId, documentIds, ... }
        │
        ▼  streamAssessmentWorkflow(parsedClaim)     AsyncGenerator
lib/workflow/assessmentWorkflow.ts
        │
        ├─ yield { type:'workflow-start', claimId }
        │
        ├─ yield { type:'step-start', step:1, stepName:'Document Verification' }
        ├─ verifyDocument(id) × N   ← pure TypeScript
        ├─ yield { type:'step-result', toolCall, line:'✓ DOC-001 verified' }
        ├─ yield { type:'step-complete', ... }
        │
        ├─ yield { type:'step-start', step:2, stepName:'Policy Verification' }
        ├─ lookupPolicy(policyId)    ← pure TypeScript
        ├─ yield { type:'step-result', toolCall, line:'✓ Policy active\n✓ surgery coverage found' }
        ├─ yield { type:'step-complete', ... }
        │
        ├─ yield { type:'step-start', step:3, stepName:'Medical Necessity' }
        ├─ checkMedicalNecessity(...)← pure TypeScript
        ├─ yield { type:'step-result', toolCall, line:'✓ Procedure medically necessary' }
        ├─ yield { type:'step-complete', ... }
        │
        │  Decision rules (TypeScript):
        │  !allDocsValid          → MORE_INFO_REQUIRED
        │  excluded | !necessary  → REJECTED
        │  all pass               → calculateBenefit() → APPROVED
        │
        ├─ yield { type:'workflow-complete', recommendation, reasoning }
        │
        ├─ (if APPROVED) yield { type:'step-start', step:4, stepName:'Benefit Calculation' }
        ├─ (if APPROVED) calculateBenefit() ← pure TypeScript
        ├─ (if APPROVED) yield { type:'step-result', toolCall, line:'✓ Covered amount: $4,500' }
        │
        ├─ Builds AssessmentReport in code
        └─ yield { type:'final-report', report, toolCalls, summary }
        │
        ▼  API route → SSE chunk per event
        │   data: {"type":"workflow-start","claimId":"CLM-001"}\n\n
        │   data: {"type":"step-start",...}\n\n
        │   ...
        │   data: {"type":"final-report",...}\n\n
        │
        ▼  ChatContainer (client) — SSE reader (async)
        │
        │  On each SSE event:
        │  ├─ workflow-start / step-start / step-result / workflow-complete / error
        │  │       → enqueue(text) — appends to pendingRef, starts RAF loop if idle
        │  ├─ step-result
        │  │       → setToolCalls(prev => [...prev, toolCall])  (immediate)
        │  └─ final-report
        │           → setReport(event.report)                   (immediate)
        │
        │  When SSE stream closes:
        │  └─ sseComplete = true
        │     if queue already empty → setIsStreaming(false) immediately
        │     else → RAF loop calls setIsStreaming(false) when queue drains
        │
        ▼  Typing queue RAF loop (requestAnimationFrame, ~60 fps)
        │
        │  Each frame:
        │  ├─ Take CHARS_PER_FRAME (5) chars from pendingRef
        │  ├─ Append to displayedRef
        │  ├─ setMessages([...baseMessages, { role:'assistant', content: displayedRef }])
        │  └─ Schedule next frame if pendingRef non-empty
        │     └─ When pendingRef empty AND sseComplete → setIsStreaming(false)
        │
        │  Abort / error path:
        │  └─ cancelAnimationFrame() → pendingRef = '' → displayedRef = finalText
        │     setMessages with finalText immediately, setIsStreaming(false)
        │
        ▼  MessageBubble renders displayedRef content with whitespace-pre-wrap
           Progressive reveal: ~300 chars/sec at 60 fps (CHARS_PER_FRAME = 5)
```

---

## SSE Event Format

```
data: {"type":"workflow-start","claimId":"CLM-001"}\n\n
data: {"type":"step-start","step":1,"stepName":"Document Verification"}\n\n
data: {"type":"step-result","toolCall":{"toolCallId":"tool-1","toolName":"verifyDocument",...},"line":"✓ DOC-001 verified"}\n\n
data: {"type":"step-result","toolCall":{...},"line":"✓ DOC-002 verified"}\n\n
data: {"type":"step-complete","step":1,"stepName":"Document Verification","summary":"All 2 document(s) verified"}\n\n
...
data: {"type":"workflow-complete","recommendation":"APPROVED","reasoning":"All criteria satisfied..."}\n\n
data: {"type":"final-report","report":{...},"toolCalls":[...],"summary":"Claim CLM-001..."}\n\n
```

---

## Client Rendering Pipeline (Typing Queue)

```
SSE network bytes arrive
        │
        ▼  ReadableStream reader (async loop)
        │  TextDecoder + "\n\n" split → WorkflowEvent objects
        │
        │  Immediate side-effects (no queuing):
        │  ├─ step-result  → setToolCalls(prev => [...prev, toolCall])
        │  └─ final-report → setReport(report)
        │
        │  Text-bearing events → enqueue(formattedLine):
        │  ├─ workflow-start → "Assessment started for claim {id}.\n"
        │  ├─ step-start     → "\n## Step N: {name}\n"
        │  ├─ step-result    → "{✓/✗ line}\n"
        │  ├─ workflow-complete → "\n---\n\n## Final Assessment\n\n{rec}\n{reasoning}\n"
        │  ├─ message        → non-claim summary text
        │  └─ error          → error description text
        │
        ▼  enqueue(text) — non-blocking
        │  pendingRef.current += text
        │  if !typingActiveRef → start RAF loop
        │
        ▼  requestAnimationFrame tick (~60 fps)
        │
        │  ┌─────────────────────────────────────────┐
        │  │  pendingRef  (characters waiting)        │
        │  │  "## Step 2: Policy Ve..."               │
        │  │       ↓ slice(0, CHARS_PER_FRAME=5)      │
        │  │  displayedRef (characters shown)         │
        │  │  "Assessment started...\n## Step 1:..."  │
        │  └─────────────────────────────────────────┘
        │
        │  setMessages([...baseMessages, { role:'assistant', content: displayedRef }])
        │  → one React re-render per frame (≤60/sec)
        │
        │  Schedule next frame if pendingRef non-empty
        │  When pendingRef empty AND sseComplete → setIsStreaming(false)
        │
        ▼  MessageBubble (whitespace-pre-wrap)
           Progressive reveal ≈ 300 chars/sec
           Blinking cursor visible while isStreaming = true
```

### Ref inventory (`ChatContainer`)

| Ref | Type | Purpose |
|---|---|---|
| `pendingRef` | `string` | Text queued by SSE, not yet shown |
| `displayedRef` | `string` | Text currently in the message bubble |
| `baseMessagesRef` | `Message[]` | History snapshot (no assistant slot) that RAF builds on |
| `rafIdRef` | `number \| null` | Active `requestAnimationFrame` ID for cancellation |
| `typingActiveRef` | `boolean` | Guard preventing duplicate RAF loops |
| `abortRef` | `AbortController \| null` | Cancels the in-flight `fetch` |

### State machine

```
sendMessage called
    ↓
IDLE → STREAMING (setIsStreaming(true))
    ↓
SSE events arrive → enqueue() fills pendingRef
RAF loop drains pendingRef → displayedRef updates MessageBubble
    ↓
SSE stream closes → sseComplete = true
    ├─ pendingRef empty → STREAMING → IDLE (setIsStreaming(false))
    └─ pendingRef not empty → RAF loop continues
            ↓ queue drains → STREAMING → IDLE

abort() called at any point
    → fetch throws AbortError
    → cancelTyping("Assessment cancelled.")
    → STREAMING → IDLE
```

---

## LLM Responsibility Boundary

| Responsibility | LLM | Application |
|---|---|---|
| Classify message type (claim vs. greeting/help) | | ✅ regex |
| Parse claim fields from user message | ✅ | |
| Return structured JSON output | ✅ | |
| Verify documents | | ✅ |
| Look up policy | | ✅ |
| Check medical necessity | | ✅ |
| Calculate benefits | | ✅ |
| Apply approval/rejection rules | | ✅ |
| Build assessment report | | ✅ |
| Orchestrate workflow | | ✅ |
| Emit progress events | | ✅ generator |
| Handle non-claim messages (greetings/help) | | ✅ static |

---

## Folder Structure

```
claim-assessment-ai/
├── app/
│   ├── api/agent/route.ts          # POST /api/agent — SSE stream of WorkflowEvent
│   ├── layout.tsx
│   ├── page.tsx                    # Main page
│   └── globals.css
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx       # SSE reader; incremental content build
│   │   ├── MessageList.tsx         # Scrollable message thread
│   │   ├── MessageBubble.tsx       # Single message (user | assistant)
│   │   ├── ChatInput.tsx           # Textarea + submit button
│   │   └── ToolCallLog.tsx         # Collapsible tool call trace panel
│   └── report/
│       ├── AssessmentReport.tsx    # Full 6-section report wrapper
│       ├── ReportSection.tsx       # Individual section
│       └── RecommendationBadge.tsx # APPROVED | REJECTED | MORE INFO badge
│
├── lib/
│   ├── providers/
│   │   └── deepseek.ts             # DeepSeek provider via @ai-sdk/openai
│   ├── classifier/
│   │   └── requestClassifier.ts    # classifyRequest() — pure regex, no LLM
│   ├── parser/
│   │   └── claimParser.ts          # parseClaim() — generateText + Zod
│   ├── workflow/
│   │   └── assessmentWorkflow.ts   # streamAssessmentWorkflow() — async generator
│   │                               # runAssessmentWorkflow() — sync (for tests)
│   ├── data/
│   │   ├── policies.ts             # Mock Policy records
│   │   ├── documents.ts            # Mock Document records
│   │   ├── medicalCodes.ts         # ICD/CPT necessity rules
│   │   └── claims.ts               # 3 test scenario claims
│   └── tools/
│       ├── lookupPolicy.ts
│       ├── calculateBenefit.ts
│       ├── verifyDocument.ts
│       └── checkMedicalNecessity.ts
│
├── types/
│   ├── agent.ts                    # ChatMessage, ToolCall
│   ├── claims.ts                   # ClaimType, Document, Claim
│   ├── policy.ts                   # Policy, Coverage, Exclusion
│   ├── report.ts                   # AssessmentReport, Recommendation
│   └── workflow.ts                 # WorkflowToolCall, WorkflowEvent
│
└── __tests__/
    ├── scenario-a-approval.test.ts
    ├── scenario-b-rejection.test.ts
    ├── scenario-c-more-info.test.ts
    ├── report.test.ts              # runAssessmentWorkflow — all 3 scenarios
    ├── provider-deepseek.test.ts   # Provider config + model selection
    ├── claim-flow.test.ts          # Tool chain per scenario + recommendation
    ├── tool-execution.test.ts      # Tool edge cases + boundary math
    ├── report-citations.test.ts    # Workflow citations + policy source data
    └── request-classifier.test.ts  # Classifier — all 4 categories + edge cases
```

---

## DeepSeek Provider

```
lib/providers/deepseek.ts

DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
DEFAULT_MODEL     = 'deepseek-chat'

createDeepSeekProvider(apiKey?)
    → createOpenAI({ name: 'deepseek', baseURL, apiKey })
    → returns OpenAIProvider (callable, with .chat(), .completion(), …)

getDeepSeekModel(model = 'deepseek-chat')
    → createDeepSeekProvider().chat(model)
    → returns LanguageModelV3 for use in generateText
```

Note: DeepSeek does not support `response_format: json_schema`. The parser uses
`generateText()` + `JSON.parse()` + `ParsedClaimSchema.parse()` instead of `generateObject()`.

---

## Tool Contracts

| Tool | Input | Returns |
|---|---|---|
| `verifyDocument` | `{ documentId }` | `{ valid, documentType, provider, issuedDate, issues }` \| error |
| `lookupPolicy` | `{ policyId }` | `{ policy: Policy }` \| error |
| `checkMedicalNecessity` | `{ diagnosis, procedures[] }` | `{ necessary, rationale, approvedProcedures, unapprovedProcedures }` |
| `calculateBenefit` | `{ policyId, claimType, amount }` | `{ coveredAmount, patientResponsibility, deductibleApplied, coveragePercent }` \| error |

---

## API Contract

```
POST /api/agent
Body: { messages: ChatMessage[], model?: "deepseek-chat" | "deepseek-reasoner" }

Response 200 — SSE stream (Content-Type: text/event-stream):
  Each line: data: <WorkflowEvent JSON>\n\n

  Claim request stream (example CLM-001):
    data: {"type":"workflow-start","claimId":"CLM-001"}
    data: {"type":"step-start","step":1,"stepName":"Document Verification"}
    data: {"type":"step-result","toolCall":{...},"line":"✓ DOC-001 verified"}
    data: {"type":"step-result","toolCall":{...},"line":"✓ DOC-002 verified"}
    data: {"type":"step-complete","step":1,"stepName":"Document Verification","summary":"All 2 document(s) verified"}
    data: {"type":"step-start","step":2,"stepName":"Policy Verification"}
    data: {"type":"step-result","toolCall":{...},"line":"✓ Policy active\n✓ surgery coverage found"}
    ...
    data: {"type":"workflow-complete","recommendation":"APPROVED","reasoning":"All criteria satisfied..."}
    data: {"type":"final-report","report":{...},"toolCalls":[...],"summary":"Claim CLM-001..."}

  Non-claim request:
    data: {"type":"message","messageClass":"greeting","summary":"..."}

Response 400: JSON { error: string }  ← validation errors, before stream starts
```

---

## Report JSON Schema

```json
{
  "claimId": "string",
  "patientName": "string",
  "assessmentDate": "YYYY-MM-DD",
  "recommendation": "APPROVED | REJECTED | MORE_INFO_REQUIRED",
  "sections": {
    "documentReview":    { "summary": "string", "findings": [] },
    "policyVerification":{ "summary": "string", "policyId": "string", "coverageDetails": {} },
    "medicalNecessity":  { "summary": "string", "necessary": true, "rationale": "string" },
    "benefitCalculation":{ "summary": "string", "coveredAmount": 0, "patientResponsibility": 0 },
    "recommendation":    { "decision": "APPROVED", "reasoning": "string" },
    "policyCitations":   [{ "section": "string", "text": "string" }]
  }
}
```

---

## Test Scenarios

| Scenario | Policy | Documents | Medical Necessity | Outcome |
|---|---|---|---|---|
| CLM-001 — Approval | POL-001 (full, deductible met) | DOC-001, DOC-002 (all valid) | appendicitis — necessary | APPROVED, $4,500 |
| CLM-002 — Rejection | POL-002 (elective excluded) | DOC-004, DOC-005 (valid) | elective cosmetic — not necessary | REJECTED |
| CLM-003 — More Info | POL-003 (standard plus) | DOC-006 (valid), DOC-003 (missing) | fracture — necessary | MORE_INFO_REQUIRED |
