# System Map

## High-Level Architecture

```
+-------------------------------------------------------------+
|                     Browser (Next.js App)                    |
|                                                             |
|  +------------------------------------------------------+  |
|  |  Presentation Layer                                   |  |
|  |  app/page.tsx                                        |  |
|  |  +- components/sidebar/Sidebar.tsx (dark nav)      |  |
|  |  |   (New Assessment, Search, grouped history,      |  |
|  |  |    inline rename/delete, empty state)            |  |
|  |  +- components/chat/ChatContainer.tsx                |  |
|  |  |   +- MessageList.tsx       (message thread)       |  |
|  |  |   +- MessageBubble.tsx     (individual message)   |  |
|  |  |   +- ChatInput.tsx         (text input + send)    |  |
|  |  |   +- WorkflowTimeline.tsx  (step progress strip)  |  |
|  |  |   +- ToolCallLog.tsx       (live tool call panel) |  |
|  |  +- components/report/MultiClaimReportPanel.tsx      |  |
|  |  |   (history summary + per-claim collapsible cards) |  |
|  |  +- components/report/AssessmentReport.tsx           |  |
|  |      +- ReportSection.tsx     (collapsible section)  |  |
|  |      +- RecommendationBadge.tsx (APPROVED/...)       |  |
|  +------------------------------------------------------+  |
|                     | POST /api/agent -> SSE stream          |
+---------------------|-----------------------------------------+
                      |
+---------------------v-----------------------------------------+
|                     Server (Next.js API)                     |
|                                                             |
|  +------------------------------------------------------+  |
|  |  API Layer                                            |  |
|  |  app/api/agent/route.ts  <- POST -> SSE stream       |  |
|  |  ReadableStream (text/event-stream)                  |  |
|  +------------------------------------------------------+  |
|                      |                                       |
|  +------------------------------------------------------+  |
|  |  Classifier Layer  (deterministic -- no LLM)         |  |
|  |  lib/classifier/requestClassifier.ts                 |  |
|  |  +- classifyRequest(message) -> MessageClass         |  |
|  |  +- claim_request / greeting / help_request /        |  |
|  |  |   unsupported                                     |  |
|  |  +- Pure regex matching -- zero latency, no API call |  |
|  +------------------------------------------------------+  |
|                      | claim_request only                    |
|  +------------------------------------------------------+  |
|  |  Parser Layer  (LLM -- structured extraction only)   |  |
|  |  lib/parser/claimParser.ts                           |  |
|  |  +- parseClaim(userMessage, model) -> ParsedClaim    |  |
|  |  +- Uses generateText() + JSON.parse + Zod           |  |
|  |  +- No tool calls, no decisions, no orchestration    |  |
|  +------------------------------------------------------+  |
|                      |                                       |
|  +------------------------------------------------------+  |
|  |  Workflow Layer  (deterministic -- async generator)  |  |
|  |  lib/workflow/assessmentWorkflow.ts                  |  |
|  |  +- streamAssessmentWorkflow(claim)                  |  |
|  |  |   AsyncGenerator<WorkflowEvent>                  |  |
|  |  +- yield workflow-start                             |  |
|  |  +- Step 1: yield tool-start                        |  |
|  |  |          verifyDocument() x N                    |  |
|  |  |          yield tool-complete + step-result       |  |
|  |  |          yield step-complete + report-update     |  |
|  |  +- Step 2: yield tool-start                        |  |
|  |  |          lookupPolicy()                          |  |
|  |  |          yield tool-complete + step-result       |  |
|  |  |          yield step-complete + report-update     |  |
|  |  +- Step 3: yield tool-start                        |  |
|  |  |          checkMedicalNecessity()                 |  |
|  |  |          yield tool-complete + step-result       |  |
|  |  |          yield step-complete + report-update     |  |
|  |  +- Decision rules in TypeScript                    |  |
|  |  +- yield workflow-complete                         |  |
|  |  +- yield report-update (recommendation section)   |  |
|  |  +- Step 4 (APPROVED only):                        |  |
|  |  |    yield tool-start, calculateBenefit()         |  |
|  |  |    yield tool-complete, step-complete            |  |
|  |  |    yield report-update (benefit section)        |  |
|  |  +- Builds full AssessmentReport in code           |  |
|  |  +- yield final-report                             |  |
|  |                                                    |  |
|  |  +- runAssessmentWorkflow(claim) -> WorkflowResult |  |
|  |     (synchronous; kept for test compatibility)     |  |
|  +------------------------------------------------------+  |
|                      |                                       |
|  +------------------------------------------------------+  |
|  |  Provider Layer                                      |  |
|  |  lib/providers/deepseek.ts                           |  |
|  |  +- createDeepSeekProvider(apiKey?)                  |  |
|  |  |   -> createOpenAI({ name, baseURL, apiKey })      |  |
|  |  +- getDeepSeekModel(model)                         |  |
|  |       -> provider.chat('deepseek-chat' | '...reason')|  |
|  +------------------------------------------------------+  |
|                      |                                       |
|  +------------------------------------------------------+  |
|  |  Tool Layer  (pure functions -- no AI SDK wrappers)  |  |
|  |  lib/tools/lookupPolicy.ts                           |  |
|  |  lib/tools/calculateBenefit.ts                       |  |
|  |  lib/tools/verifyDocument.ts                         |  |
|  |  lib/tools/checkMedicalNecessity.ts                  |  |
|  +------------------------------------------------------+  |
|                      |                                       |
|  +------------------------------------------------------+  |
|  |  Data Layer (in-memory mock)                         |  |
|  |  lib/data/policies.ts     <- 3 mock policies         |  |
|  |  lib/data/documents.ts    <- mock documents per claim|  |
|  |  lib/data/medicalCodes.ts <- ICD/CPT necessity rules |  |
|  |  lib/data/claims.ts       <- 3 test scenario claims  |  |
|  +------------------------------------------------------+  |
|                                                             |
|  +------------------------------------------------------+  |
|  |  Type Layer                                          |  |
|  |  types/agent.ts      <- ChatMessage, ToolCall        |  |
|  |  types/claims.ts     <- Claim, ClaimType, Document   |  |
|  |  types/policy.ts     <- Policy, Coverage, Exclusion  |  |
|  |  |                     CoverageClause (clauseId)    |  |
|  |  types/report.ts     <- AssessmentReport             |  |
|  |  |                     PartialAssessmentReport       |  |
|  |  |                     Recommendation                |  |
|  |  |                     DecisionFactor (audit trail) |  |
|  |  |                     ReasoningSection              |  |
|  |  types/workflow.ts   <- WorkflowToolCall             |  |
|  |                         WorkflowEvent (11 variants)  |  |
|  +------------------------------------------------------+  |
+-------------------------------------------------------------+
                      |
+---------------------v-----------------------------------------+
|      DeepSeek API  (OpenAI-compatible chat completions)      |
|      baseURL: https://api.deepseek.com                       |
|      Auth:    DEEPSEEK_API_KEY                               |
|      Models:  deepseek-chat (default) . deepseek-reasoner    |
|      SDK:     @ai-sdk/openai  -> generateText() only         |
|      Role:    claim field extraction (no tool calls)         |
+-------------------------------------------------------------+
```

---

## Request Flow (Streaming Application-Driven with T18 events)

```
User submits any message
        |
        v
POST /api/agent  { messages, model? }
        |
        v  classifyRequest(lastUserMessage)      <- pure regex, no LLM
lib/classifier/requestClassifier.ts
        |
        +- greeting / help_request / unsupported
        |       v SSE: single { type:'message', summary } event then close
        |
        +- claim_request
                v
        parseClaim(lastUserMessage, model)
lib/parser/claimParser.ts
        |  generateText(system=PARSER_SYSTEM, prompt=userMessage)
        |  -> DeepSeek returns raw JSON string
        |  -> JSON.parse() + ParsedClaimSchema.parse()
        v  ParsedClaim { claimId, policyId, documentIds, ... }
        |
        v  streamAssessmentWorkflow(parsedClaim)     AsyncGenerator
lib/workflow/assessmentWorkflow.ts
        |
        +- yield { type:'workflow-start', claimId }
        |
        +- yield { type:'step-start', step:1, stepName:'Document Verification' }
        +- for each documentId:
        |    yield { type:'tool-start', toolCallId, toolName:'verifyDocument', input }
        |    verifyDocument(id)   <- pure TypeScript
        |    yield { type:'tool-complete', toolCall(status:completed), line }
        |    yield { type:'step-result', toolCall, line }   (legacy)
        +- yield { type:'step-complete', step:1, ... }
        +- yield { type:'report-update', partial:{documentReview}, step:1 }
        |
        +- yield { type:'step-start', step:2, stepName:'Policy Verification' }
        +- yield { type:'tool-start', toolCallId, toolName:'lookupPolicy', input }
        +- lookupPolicy(policyId)  <- pure TypeScript
        +- yield { type:'tool-complete', toolCall(status:completed), line }
        +- yield { type:'step-result', ... }
        +- yield { type:'step-complete', step:2, ... }
        +- yield { type:'report-update', partial:{policyVerification,policyCitations} }
        |
        +- yield { type:'step-start', step:3, stepName:'Medical Necessity' }
        +- yield { type:'tool-start', toolCallId, toolName:'checkMedicalNecessity', input }
        +- checkMedicalNecessity()  <- pure TypeScript
        +- yield { type:'tool-complete', toolCall(status:completed), line }
        +- yield { type:'step-result', ... }
        +- yield { type:'step-complete', step:3, ... }
        +- yield { type:'report-update', partial:{medicalNecessity} }
        |
        |  Decision rules (TypeScript):
        |  !allDocsValid         -> MORE_INFO_REQUIRED
        |  excluded | !necessary -> REJECTED
        |  all pass              -> APPROVED
        |
        +- (if NOT APPROVED) yield report-update{benefitCalculation:N/A}
        |
        +- (if APPROVED) yield { type:'step-start', step:4 }
        +- (if APPROVED) yield { type:'tool-start', toolName:'calculateBenefit' }
        +- (if APPROVED) calculateBenefit()  <- pure TypeScript
        +- (if APPROVED) yield { type:'tool-complete', ... }
        +- (if APPROVED) yield { type:'step-complete', step:4, ... }
        +- (if APPROVED) yield { type:'report-update', partial:{benefitCalculation} }
        |
        +- yield { type:'workflow-complete', recommendation, reasoning }
        +- yield { type:'report-update', partial:{recommendation, sections.recommendation} }
        |
        +- Builds full AssessmentReport in code
        +- yield { type:'final-report', report, toolCalls, summary }
        |
        v  API route -> SSE chunk per event
        |   data: {"type":"workflow-start","claimId":"CLM-001"}\n\n
        |   data: {"type":"step-start",...}\n\n
        |   data: {"type":"tool-start",...}\n\n
        |   data: {"type":"tool-complete",...}\n\n
        |   ...
        |   data: {"type":"final-report",...}\n\n
        |
        v  ChatContainer (client) -- synchronized SSE consumer
```

---

## Client Rendering Pipeline (Synchronized Effects Queue)

```
SSE network bytes arrive (all events arrive at network speed)
        |
        v  ReadableStream reader (async loop)
        |  TextDecoder + "\n\n" split -> WorkflowEvent objects
        |
        |  Synchronized side-effect queue:
        |  scheduleEffect(fn) registers fn to fire when displayedRef.length
        |  reaches totalEnqueuedRef.current -- no immediate React state updates
        |
        |  Per-event handling:
        |
        |  workflow-start
        |    enqueue("Assessment started for claim {id}.\n")
        |
        |  step-start
        |    scheduleEffect(() => setWorkflowSteps(markRunning))  <- before text
        |    enqueue("\n## Step N: {name}\n")
        |
        |  tool-start
        |    scheduleEffect(() => setToolCalls(addRunning))  <- when header done
        |
        |  tool-complete
        |    enqueue("{line}\n")
        |    scheduleEffect(() => setToolCalls(setDone))  <- after line typed
        |
        |  step-result  -> no-op (handled by tool-start/tool-complete)
        |
        |  step-complete
        |    scheduleEffect(() => setWorkflowSteps(markCompleted))
        |
        |  report-update
        |    scheduleEffect(() => setReport(merge(prev, partial)))
        |
        |  workflow-complete
        |    enqueue("\n---\n\n## Final Assessment\n\n{rec}\n{reasoning}\n")
        |
        |  final-report
        |    scheduleEffect(() => setReport(fullReport))
        |
        v  enqueue(text) -- non-blocking
        |  pendingRef.current += text
        |  totalEnqueuedRef.current += text.length
        |  if !typingActiveRef -> start RAF loop
        |
        v  requestAnimationFrame tick (~60 fps)
        |
        |  +------------------------------------------+
        |  |  pendingRef  (characters waiting)         |
        |  |  "## Step 2: Policy Ve..."                |
        |  |       v slice(0, CHARS_PER_FRAME=5)       |
        |  |  displayedRef (all chars revealed so far) |
        |  |  "Assessment started...\n## Step 1:..."   |
        |  |       v displayedRef.length == revealedPos|
        |  |  scheduledEffectsRef.filter(e =>          |
        |  |    e.fireAtPos <= revealedPos)             |
        |  |       v fire each due effect in order     |
        |  |  setWorkflowSteps / setToolCalls /        |
        |  |  setReport fire here, not at network speed|
        |  +------------------------------------------+
        |
        |  setMessages([...baseMessages, { role:'assistant', content: displayedRef }])
        |  -> one React re-render per frame (<=60/sec)
        |
        |  Schedule next frame if pendingRef non-empty
        |  When pendingRef empty AND sseComplete -> flush remaining effects -> setIsStreaming(false)
        |
        v  UI panels update in lockstep with typing animation:
           WorkflowTimeline  step appears RUNNING as its header starts
           ToolCallLog       tool appears RUNNING when step header done
                             tool turns DONE after its result line types
           AssessmentReport  section appears when step narration completes
           (sections show "Pending..." until their step completes)
```

### Ref inventory (`ChatContainer`)

| Ref | Type | Purpose |
|---|---|---|
| `pendingRef` | `string` | Text queued by SSE, not yet shown |
| `displayedRef` | `string` | All chars revealed so far (cumulative) |
| `totalEnqueuedRef` | `number` | Cumulative chars ever pushed to pendingRef |
| `scheduledEffectsRef` | `ScheduledEffect[]` | Queue of `{fireAtPos, effect}` — fires when `displayedRef.length >= fireAtPos` |
| `baseMessagesRef` | `Message[]` | History snapshot (no assistant slot) the RAF builds messages on |
| `rafIdRef` | `number \| null` | Active `requestAnimationFrame` ID for cancellation |
| `typingActiveRef` | `boolean` | Guard preventing duplicate RAF loops |
| `abortRef` | `AbortController \| null` | Cancels the in-flight `fetch` |

### Tool Lifecycle (per tool call)

```
SSE:  tool-start                tool-complete
       |                              |
       v                              v
scheduleEffect(addRunning)     enqueue(line)
  fires when step header done  scheduleEffect(setDone)
       |                          fires after line typed
       v                              |
ToolCallLog: [RUNNING yellow]  ToolCallLog: [DONE green]
```

### State machine

```
sendMessage called
    v
IDLE -> STREAMING (setIsStreaming(true))
    v
SSE events arrive -> enqueue() fills pendingRef + scheduleEffect() registers side effects
RAF loop drains pendingRef -> displayedRef updates MessageBubble
  At each char reveal: fire any effects whose fireAtPos <= displayedRef.length
    -> WorkflowTimeline updates (step RUNNING -> DONE)
    -> ToolCallLog updates (tool RUNNING -> DONE)
    -> AssessmentReport grows (sections appear progressively)
    v
SSE stream closes -> sseComplete = true
    +- pendingRef empty -> flush remaining effects -> STREAMING -> IDLE
    +- pendingRef not empty -> RAF loop continues
            v queue drains -> flush remaining effects -> STREAMING -> IDLE

abort() called at any point
    -> fetch throws AbortError
    -> cancelTyping("Assessment cancelled.")
    -> STREAMING -> IDLE
```

---

## SSE Event Sequence (APPROVED claim, e.g. CLM-001)

```
data: {"type":"workflow-start","claimId":"CLM-001"}
data: {"type":"step-start","step":1,"stepName":"Document Verification"}
data: {"type":"tool-start","toolCallId":"tool-1","toolName":"verifyDocument","input":{"documentId":"DOC-001"},"step":1}
data: {"type":"tool-complete","toolCall":{...,"status":"completed"},"line":"... DOC-001 verified","step":1}
data: {"type":"step-result","toolCall":{...},"line":"... DOC-001 verified"}
data: {"type":"tool-start","toolCallId":"tool-2",...}
data: {"type":"tool-complete",...}
data: {"type":"step-result",...}
data: {"type":"step-complete","step":1,"stepName":"Document Verification","summary":"All 2 document(s) verified"}
data: {"type":"report-update","partial":{"claimId":"CLM-001","sections":{"documentReview":{...}}},"step":1}
data: {"type":"step-start","step":2,"stepName":"Policy Verification"}
data: {"type":"tool-start","toolCallId":"tool-3",...}
data: {"type":"tool-complete",...}
data: {"type":"step-result",...}
data: {"type":"step-complete","step":2,...}
data: {"type":"report-update","partial":{"sections":{"policyVerification":{...},"policyCitations":[...]}},"step":2}
... (step 3 Medical Necessity)
data: {"type":"workflow-complete","recommendation":"APPROVED","reasoning":"..."}
data: {"type":"report-update","partial":{"recommendation":"APPROVED","sections":{"recommendation":{...}}},"step":0}
... (step 4 Benefit Calculation)
data: {"type":"final-report","report":{...complete report...},"toolCalls":[...],"summary":"..."}
```

---

## LLM Responsibility Boundary

| Responsibility | LLM | Application |
|---|---|---|
| Classify message type (claim vs. greeting/help) | | Yes regex |
| Parse claim fields from user message | Yes | |
| Return structured JSON output | Yes | |
| Verify documents | | Yes |
| Look up policy | | Yes |
| Check medical necessity | | Yes |
| Calculate benefits | | Yes |
| Apply approval/rejection rules | | Yes |
| Build assessment report | | Yes |
| Orchestrate workflow | | Yes |
| Emit progress events (incl. tool-start/tool-complete/report-update) | | Yes generator |
| Handle non-claim messages (greetings/help) | | Yes static |

---

## Folder Structure

```
claim-assessment-ai/
+-- app/
|   +-- api/agent/route.ts          # POST /api/agent -- SSE stream of WorkflowEvent
|   +-- layout.tsx
|   +-- page.tsx                    # Main page
|   +-- globals.css
|
+-- components/
|   +-- sidebar/
|   |   +-- Sidebar.tsx             # Dark conversation history panel (T20)
|   +-- chat/
|   |   +-- ChatContainer.tsx       # Conversation mgmt + SSE reader + synchronized effects (T17+T19+T20)
|   |   +-- MessageList.tsx         # Scrollable message thread
|   |   +-- MessageBubble.tsx       # Single message (user | assistant)
|   |   +-- ChatInput.tsx           # Textarea + submit button
|   |   +-- WorkflowTimeline.tsx    # Horizontal step tracker (pending/running/done/failed)
|   |   +-- ToolCallLog.tsx         # Live tool call panel (running->completed states)
|   +-- report/
|       +-- MultiClaimReportPanel.tsx # Claim History + per-claim expandable reports (T21)
|       +-- AssessmentReport.tsx    # Progressive 6-section report (accepts PartialAssessmentReport)
|       +-- ReportSection.tsx       # Individual collapsible section
|       +-- RecommendationBadge.tsx # APPROVED | REJECTED | MORE INFO badge
|
+-- lib/
|   +-- providers/
|   |   +-- deepseek.ts             # DeepSeek provider via @ai-sdk/openai
|   +-- classifier/
|   |   +-- requestClassifier.ts    # classifyRequest() -- pure regex, no LLM
|   +-- parser/
|   |   +-- claimParser.ts          # parseClaim() -- generateText + Zod
|   +-- workflow/
|   |   +-- assessmentWorkflow.ts   # streamAssessmentWorkflow() -- async generator (T18)
|   |                               # runAssessmentWorkflow() -- sync (for tests)
|   +-- data/
|   |   +-- policies.ts
|   |   +-- documents.ts
|   |   +-- medicalCodes.ts
|   |   +-- claims.ts
|   +-- tools/
|       +-- lookupPolicy.ts
|       +-- calculateBenefit.ts
|       +-- verifyDocument.ts
|       +-- checkMedicalNecessity.ts
|
+-- types/
|   +-- agent.ts                    # ChatMessage, ToolCall
|   +-- claims.ts                   # ClaimType, Document, Claim
|   +-- policy.ts                   # Policy, Coverage, Exclusion
|   +-- report.ts                   # AssessmentReport, PartialAssessmentReport, Recommendation
|   +-- workflow.ts                 # WorkflowToolCall, WorkflowEvent (11 variants)
|
+-- __tests__/
    +-- scenario-a-approval.test.ts
    +-- scenario-b-rejection.test.ts
    +-- scenario-c-more-info.test.ts
    +-- report.test.ts
    +-- provider-deepseek.test.ts
    +-- claim-flow.test.ts
    +-- tool-execution.test.ts
    +-- report-citations.test.ts
    +-- request-classifier.test.ts
```

---

## DeepSeek Provider

```
lib/providers/deepseek.ts

DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
DEFAULT_MODEL     = 'deepseek-chat'

createDeepSeekProvider(apiKey?)
    -> createOpenAI({ name: 'deepseek', baseURL, apiKey })
    -> returns OpenAIProvider (callable, with .chat(), .completion(), ...)

getDeepSeekModel(model = 'deepseek-chat')
    -> createDeepSeekProvider().chat(model)
    -> returns LanguageModelV3 for use in generateText
```

Note: DeepSeek does not support `response_format: json_schema`. The parser uses
`generateText()` + `JSON.parse()` + `ParsedClaimSchema.parse()` instead of `generateObject()`.

---

## Tool Contracts

| Tool | Input | Returns |
|---|---|---|
| `verifyDocument` | `{ documentId }` | `{ valid, documentType, provider, issuedDate, issues }` or error |
| `lookupPolicy` | `{ policyId }` | `{ policy: Policy }` or error |
| `checkMedicalNecessity` | `{ diagnosis, procedures[] }` | `{ necessary, rationale, approvedProcedures, unapprovedProcedures }` |
| `calculateBenefit` | `{ policyId, claimType, amount }` | `{ coveredAmount, patientResponsibility, deductibleApplied, coveragePercent }` or error |

---

## API Contract

```
POST /api/agent
Body: { messages: ChatMessage[], model?: "deepseek-chat" | "deepseek-reasoner" }

Response 200 -- SSE stream (Content-Type: text/event-stream):
  Each line: data: <WorkflowEvent JSON>\n\n

Response 400: JSON { error: string }  <- validation errors, before stream starts
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
| CLM-001 -- Approval | POL-001 (full, deductible met) | DOC-001, DOC-002 (all valid) | appendicitis -- necessary | APPROVED, $4,500 |
| CLM-002 -- Rejection | POL-002 (elective excluded) | DOC-004, DOC-005 (valid) | elective cosmetic -- not necessary | REJECTED |
| CLM-003 -- More Info | POL-003 (standard plus) | DOC-006 (valid), DOC-003 (missing) | fracture -- necessary | MORE_INFO_REQUIRED |
