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
│  │  │   └─ ToolCallLog.tsx  (tool call visibility)      │  │
│  │  └─ components/report/AssessmentReport.tsx           │  │
│  │      ├─ ReportSection.tsx (collapsible section)      │  │
│  │      └─ RecommendationBadge.tsx (Approve/Reject/…)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │ POST /api/agent (SSE stream)     │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Application Layer                                    │  │
│  │  app/api/agent/route.ts   ← POST handler             │  │
│  │  lib/agent/agent.ts       ← streamText + tool loop   │  │
│  │  lib/agent/prompts.ts     ← system prompt            │  │
│  │  lib/agent/tools.ts       ← Vercel AI SDK schemas    │  │
│  │  lib/report/generateReport.ts ← parse <report> JSON  │  │
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
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Type Layer                                           │  │
│  │  types/agent.ts    ← Message, ToolCall, AgentState   │  │
│  │  types/claims.ts   ← Claim, ClaimType, Document      │  │
│  │  types/policy.ts   ← Policy, Coverage, Exclusion     │  │
│  │  types/report.ts   ← AssessmentReport, Section       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Anthropic API (claude-sonnet-4-6)               │
│              via Vercel AI SDK — streamText()                │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent Run Loop (ReAct Pattern)

```
User submits claim details
        │
        ▼
POST /api/agent  →  streamText(model, messages, tools)
        │
        ▼
Claude reasons about what to do next
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
        Claude generates final text response
        ending with: <report>{ ... JSON ... }</report>
                │
                ▼
        Stream SSE chunks to client
                │
                ▼
        Client parses <report> JSON → renders AssessmentReport
```

---

## Folder Structure

```
claim-assessment-ai/
├── app/
│   ├── api/
│   │   └── agent/
│   │       └── route.ts            # POST /api/agent — streaming endpoint
│   ├── layout.tsx
│   ├── page.tsx                    # Main page — mounts ChatContainer
│   └── globals.css
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx       # State orchestrator; holds messages + report
│   │   ├── MessageList.tsx         # Scrollable message thread
│   │   ├── MessageBubble.tsx       # Single message (user | assistant)
│   │   ├── ChatInput.tsx           # Textarea + submit button
│   │   └── ToolCallLog.tsx         # Collapsible tool call trace panel
│   └── report/
│       ├── AssessmentReport.tsx    # Full 6-section report wrapper
│       ├── ReportSection.tsx       # Individual section with heading + body
│       └── RecommendationBadge.tsx # APPROVED | REJECTED | MORE INFO badge
│
├── lib/
│   ├── agent/
│   │   ├── agent.ts                # runAgent() — wraps streamText, exposes stream
│   │   ├── prompts.ts              # SYSTEM_PROMPT constant
│   │   └── tools.ts                # Tool definitions (Vercel AI SDK format)
│   ├── data/
│   │   ├── policies.ts             # Mock Policy records
│   │   ├── documents.ts            # Mock Document records
│   │   └── medicalCodes.ts         # Mock ICD/CPT necessity rules
│   ├── report/
│   │   └── generateReport.ts       # parseReportFromText() — extracts JSON
│   └── tools/
│       ├── lookupPolicy.ts
│       ├── calculateBenefit.ts
│       ├── verifyDocument.ts
│       └── checkMedicalNecessity.ts
│
└── types/
    ├── agent.ts                    # ChatMessage, ToolCall, AgentState
    ├── claims.ts                   # Claim, ClaimType, Document, DocumentStatus
    ├── policy.ts                   # Policy, Coverage, Exclusion, PolicyStatus
    └── report.ts                   # AssessmentReport, ReportSection, Recommendation
```

---

## Data Flow

```
User Input (claim details)
    │
    ▼  POST body: { messages: ChatMessage[] }
app/api/agent/route.ts
    │
    ▼  runAgent(messages)
lib/agent/agent.ts  ←  lib/agent/prompts.ts
    │                  lib/agent/tools.ts
    │
    ▼  tool invocations
lib/tools/*.ts  ←  lib/data/*.ts
    │
    ▼  StreamData chunks (text + toolResult events)
HTTP SSE response
    │
    ▼  useChat() / fetch + ReadableStream
components/chat/ChatContainer.tsx
    │
    ├─► MessageList + MessageBubble    (streaming text)
    ├─► ToolCallLog                    (tool trace)
    └─► AssessmentReport               (parsed <report> JSON)
```

---

## Tool Contracts

| Tool | Input | Returns |
|---|---|---|
| `lookupPolicy` | `{ policyId: string }` | `Policy \| { error: string }` |
| `calculateBenefit` | `{ policyId, claimType, amount }` | `{ covered, patientResponsibility, details }` |
| `verifyDocument` | `{ documentId: string }` | `{ valid, issues, documentType }` |
| `checkMedicalNecessity` | `{ diagnosis, procedures: string[] }` | `{ necessary, rationale, codes }` |

---

## Report JSON Schema

```json
{
  "claimId": "string",
  "patientName": "string",
  "assessmentDate": "ISO date string",
  "recommendation": "APPROVED | REJECTED | MORE_INFO_REQUIRED",
  "sections": {
    "documentReview": { "summary": "string", "findings": [] },
    "policyVerification": { "summary": "string", "policyId": "string", "coverageDetails": {} },
    "medicalNecessity": { "summary": "string", "necessary": true, "rationale": "string" },
    "benefitCalculation": { "summary": "string", "coveredAmount": 0, "patientResponsibility": 0 },
    "recommendation": { "decision": "APPROVED", "reasoning": "string" },
    "policyCitations": [{ "section": "string", "text": "string" }]
  }
}
```

---

## Test Scenarios

| Scenario | Policy | Documents | Medical Necessity | Outcome |
|---|---|---|---|---|
| T1 — Approval | POL-001 (full coverage) | All valid | Appendicitis — necessary | APPROVED, $4,500 benefit |
| T2 — Rejection | POL-002 (excludes elective) | Valid | Elective cosmetic — not necessary | REJECTED |
| T3 — More Info | POL-003 (standard) | Missing itemized bill | N/A | MORE_INFO_REQUIRED |
