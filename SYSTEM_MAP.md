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
│                           │ POST /api/agent (SSE stream)     │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Application Layer                                    │  │
│  │  app/api/agent/route.ts  ← POST, model selection     │  │
│  │  lib/agent/agent.ts      ← streamText + tool loop    │  │
│  │  lib/agent/prompts.ts    ← system prompt             │  │
│  │  lib/agent/tools.ts      ← AI SDK v6 inputSchema     │  │
│  │  lib/report/generateReport.ts ← parse <report> JSON  │  │
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
│  │  Tool Layer                                           │  │
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
│      SDK:     @ai-sdk/openai  →  .chat(modelId)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent Run Loop (ReAct Pattern)

```
User submits claim details
        │
        ▼
POST /api/agent  { messages, model? }
        │
        ▼  runAgent(messages, model)
lib/agent/agent.ts
        │  streamText(getDeepSeekModel(model), system, messages, tools)
        │  stopWhen: stepCountIs(10)
        ▼
DeepSeek reasons about what to do next
        │
        ├─ tool_call: verifyDocument(documentId)
        │       ↓ result → fed back into messages
        ├─ tool_call: lookupPolicy(policyId)
        │       ↓ result → fed back into messages
        ├─ tool_call: checkMedicalNecessity(diagnosis, procedures)
        │       ↓ result → fed back into messages
        └─ tool_call: calculateBenefit(policyId, claimType, amount)
                ↓ result → fed back into messages
                │
                ▼
        DeepSeek generates final text response
        ending with: <report>{ ... JSON ... }</report>
                │
                ▼
        .toTextStreamResponse() → SSE stream to client
                │
                ▼
        Client parses <report> JSON → renders AssessmentReport
```

---

## Folder Structure

```
claim-assessment-ai/
├── app/
│   ├── api/agent/route.ts          # POST /api/agent — model-aware streaming endpoint
│   ├── layout.tsx
│   ├── page.tsx                    # Main page
│   └── globals.css
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx       # State orchestrator
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
│   ├── agent/
│   │   ├── agent.ts                # runAgent(messages, model) → streamText
│   │   ├── prompts.ts              # SYSTEM_PROMPT
│   │   └── tools.ts                # agentTools (AI SDK v6 inputSchema)
│   ├── data/
│   │   ├── policies.ts             # Mock Policy records
│   │   ├── documents.ts            # Mock Document records
│   │   ├── medicalCodes.ts         # ICD/CPT necessity rules
│   │   └── claims.ts               # 3 test scenario claims
│   ├── report/
│   │   └── generateReport.ts       # parseReportFromText()
│   └── tools/
│       ├── lookupPolicy.ts
│       ├── calculateBenefit.ts
│       ├── verifyDocument.ts
│       └── checkMedicalNecessity.ts
│
├── types/
│   ├── agent.ts                    # ChatMessage, ToolCall, AgentState
│   ├── claims.ts                   # ClaimType, Document, Claim
│   ├── policy.ts                   # Policy, Coverage, Exclusion
│   └── report.ts                   # AssessmentReport, Recommendation
│
└── __tests__/
    ├── scenario-a-approval.test.ts
    ├── scenario-b-rejection.test.ts
    ├── scenario-c-more-info.test.ts
    ├── report.test.ts
    ├── provider-deepseek.test.ts   # Provider config + model selection
    ├── claim-flow.test.ts          # End-to-end workflow per scenario
    ├── tool-execution.test.ts      # Tool edge cases + boundary math
    └── report-citations.test.ts    # Report round-trip + citation source validation
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
    → returns LanguageModelV3 for use in streamText / generateText
```

---

## Tool Contracts

| Tool | Input | Returns |
|---|---|---|
| `verifyDocument` | `{ documentId }` | `{ valid, documentType, provider, issuedDate, issues }` \| error |
| `lookupPolicy` | `{ policyId }` | `{ policy: Policy }` \| error |
| `checkMedicalNecessity` | `{ diagnosis, procedures[] }` | `{ necessary, rationale, approvedProcedures, unapprovedProcedures }` |
| `calculateBenefit` | `{ policyId, claimType, amount }` | `{ coveredAmount, patientResponsibility, deductibleApplied, coveragePercent }` \| error |

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
