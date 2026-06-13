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
│                           │ POST /api/agent → JSON           │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Layer                                            │  │
│  │  app/api/agent/route.ts  ← POST → JSON response      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Parser Layer  (LLM — structured extraction only)     │  │
│  │  lib/parser/claimParser.ts                           │  │
│  │  ├─ parseClaim(userMessage, model) → ParsedClaim     │  │
│  │  ├─ Uses generateText() + JSON.parse + Zod           │  │
│  │  └─ No tool calls, no decisions, no orchestration    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Workflow Layer  (deterministic application logic)    │  │
│  │  lib/workflow/assessmentWorkflow.ts                  │  │
│  │  ├─ runAssessmentWorkflow(claim) → WorkflowResult    │  │
│  │  ├─ Step 1: verifyDocument() × N documents          │  │
│  │  ├─ Step 2: lookupPolicy()                          │  │
│  │  ├─ Step 3: checkMedicalNecessity()                 │  │
│  │  ├─ Step 4: calculateBenefit() (only if APPROVED)   │  │
│  │  ├─ Decision rules in TypeScript                    │  │
│  │  └─ Builds AssessmentReport in code                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Provider Layer                                       │  │
│  │  lib/providers/deepseek.ts                           │  │
│  │  ├─ createDeepSeekProvider(apiKey?)                  │  │
│  │  │   → createOpenAI({ name, baseURL, apiKey })       │  │
│  │  └─ getDeepSeekModel(model)                         │  │
│  │       → provider.chat('deepseek-chat' | '…reasoner') │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Layer  (pure functions — no AI SDK wrappers)    │  │
│  │  lib/tools/lookupPolicy.ts                           │  │
│  │  lib/tools/calculateBenefit.ts                       │  │
│  │  lib/tools/verifyDocument.ts                         │  │
│  │  lib/tools/checkMedicalNecessity.ts                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
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
│  │  types/agent.ts    ← ChatMessage, ToolCall           │  │
│  │  types/claims.ts   ← Claim, ClaimType, Document      │  │
│  │  types/policy.ts   ← Policy, Coverage, Exclusion     │  │
│  │  types/report.ts   ← AssessmentReport, Recommendation│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│      DeepSeek API  (OpenAI-compatible chat completions)      │
│      baseURL: https://api.deepseek.com                       │
│      Auth:    DEEPSEEK_API_KEY                               │
│      Models:  deepseek-chat (default) · deepseek-reasoner    │
│      SDK:     @ai-sdk/openai  → generateText() only          │
│      Role:    claim field extraction (no tool calls)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Flow (Application-Driven)

```
User submits claim details
        │
        ▼
POST /api/agent  { messages, model? }
        │
        ▼  parseClaim(lastUserMessage, model)
lib/parser/claimParser.ts
        │  generateText(system=PARSER_SYSTEM, prompt=userMessage)
        │  → DeepSeek returns raw JSON string
        │  → JSON.parse() + ParsedClaimSchema.parse()
        ▼  ParsedClaim { claimId, policyId, documentIds, ... }
        │
        ▼  runAssessmentWorkflow(parsedClaim)
lib/workflow/assessmentWorkflow.ts
        │
        ├─ verifyDocument(documentId) × N  ← pure TypeScript
        ├─ lookupPolicy(policyId)           ← pure TypeScript
        ├─ checkMedicalNecessity(...)       ← pure TypeScript
        │
        │  Decision rules (TypeScript):
        │  !allDocsValid          → MORE_INFO_REQUIRED
        │  excluded | !necessary  → REJECTED
        │  all pass               → calculateBenefit() → APPROVED
        │
        └─ Builds AssessmentReport in code
        │
        ▼
{ report: AssessmentReport, toolCalls: WorkflowToolCall[], summary: string }
        │
        ▼  Response.json(result)
        │
        ▼  ChatContainer (client)
        - summary → assistant MessageBubble
        - toolCalls → ToolCallLog (all status: 'done')
        - report → AssessmentReportView
```

---

## LLM Responsibility Boundary

| Responsibility | LLM | Application |
|---|---|---|
| Parse claim fields from user message | ✅ | |
| Return structured JSON output | ✅ | |
| Verify documents | | ✅ |
| Look up policy | | ✅ |
| Check medical necessity | | ✅ |
| Calculate benefits | | ✅ |
| Apply approval/rejection rules | | ✅ |
| Build assessment report | | ✅ |
| Orchestrate workflow | | ✅ |

---

## Folder Structure

```
claim-assessment-ai/
├── app/
│   ├── api/agent/route.ts          # POST /api/agent — parse + workflow → JSON
│   ├── layout.tsx
│   ├── page.tsx                    # Main page
│   └── globals.css
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx       # JSON fetch, no SSE
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
│   ├── parser/
│   │   └── claimParser.ts          # parseClaim() — generateText + Zod
│   ├── workflow/
│   │   └── assessmentWorkflow.ts   # runAssessmentWorkflow() — deterministic
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
│   └── report.ts                   # AssessmentReport, Recommendation
│
└── __tests__/
    ├── scenario-a-approval.test.ts
    ├── scenario-b-rejection.test.ts
    ├── scenario-c-more-info.test.ts
    ├── report.test.ts              # runAssessmentWorkflow — all 3 scenarios
    ├── provider-deepseek.test.ts   # Provider config + model selection
    ├── claim-flow.test.ts          # Tool chain per scenario + recommendation
    ├── tool-execution.test.ts      # Tool edge cases + boundary math
    └── report-citations.test.ts    # Workflow citations + policy source data
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

Response 200: {
  report:    AssessmentReport,
  toolCalls: WorkflowToolCall[],   // all status: "done"
  summary:   string
}

Response 400: { error: string }
Response 500: { error: string }
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
