# Project State

## Status: Phases 1–4 Complete — UI Next

---

## Completed

- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (AGENTS.md)
- Architecture design (SYSTEM_MAP.md)
- Folder structure definition + implementation plan
- **T1** — TypeScript type definitions (`types/`)
- **T2** — Mock data layer (`lib/data/`)
- **T3** — 4 tool function implementations (`lib/tools/`)
- **T4** — Vercel AI SDK v6 tool schemas (`lib/agent/tools.ts`)
- **T5** — System prompt with workflow + report format (`lib/agent/prompts.ts`)
- **T6** — Agent runner with streaming + tool logging (`lib/agent/agent.ts`)
- **T7** — Streaming API route (`app/api/agent/route.ts`)
- **T8** — Report parser (`lib/report/generateReport.ts`)
- **T12** — 3 test scenarios (26 tests, all passing)
- **T13** — TypeScript + ESLint clean (0 errors)

---

## In Progress

- (nothing — ready for Phase 5: UI)

---

## Todo

### Phase 5 — UI
- [ ] **T9** — Chat components  
  `components/chat/` — ChatContainer, MessageList, MessageBubble, ChatInput, ToolCallLog

- [ ] **T10** — Report components  
  `components/report/` — AssessmentReport, ReportSection, RecommendationBadge

- [ ] **T11** — Page integration  
  `app/page.tsx` — mount `<ChatContainer />`

---

## Installed Dependencies

```
ai@6.0.203           Vercel AI SDK (streamText, stepCountIs, tool)
@ai-sdk/anthropic@3  Anthropic provider (claude-sonnet-4-6)
zod@4.4.3            Schema validation for tool inputSchema
vitest@4.1.8         Test runner
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI provider | Anthropic Claude (`claude-sonnet-4-6`) | Tool use + structured output |
| AI SDK | Vercel AI SDK v6 (`ai`) | SSE streaming + App Router |
| Tool schema | `inputSchema` via Zod (AI SDK v6 API) | Changed from `parameters` in v4/v5 |
| Multi-step | `stopWhen: stepCountIs(10)` | Replaced `maxSteps` in SDK v6 |
| Streaming response | `toTextStreamResponse()` | Replaced `toDataStreamResponse()` in SDK v6 |
| Report extraction | `<report>` XML tag in assistant text | Simple parse, no extra API call |
| State management | React `useState` / `useReducer` | No external lib needed |
| Mock data | In-memory TypeScript objects | No DB required for agent demo |

---

## Test Results

```
Test Files: 4 passed
Tests:      26 passed
```

| File | Tests | Coverage |
|---|---|---|
| `scenario-a-approval.test.ts` | 5 | CLM-001 — docs valid, POL-001, appendicitis → APPROVED $4,500 |
| `scenario-b-rejection.test.ts` | 5 | CLM-002 — elective excluded, not necessary → REJECTED |
| `scenario-c-more-info.test.ts` | 5 | CLM-003 — missing itemized bill → MORE_INFO_REQUIRED |
| `report.test.ts` | 7 | parseReportFromText — valid, invalid, all 3 recommendations |

---

## Agent Architecture

```
POST /api/agent/route.ts
    ↓ runAgent(messages)
lib/agent/agent.ts
    → streamText(claude-sonnet-4-6, system, messages, tools, stopWhen: stepCountIs(10))
    → onStepFinish: console.log tool calls per step
    ↓ tool calls
lib/agent/tools.ts  (inputSchema + execute)
    ↓
lib/tools/verifyDocument | lookupPolicy | checkMedicalNecessity | calculateBenefit
    ↓
lib/data/documents | policies | medicalCodes
    ↓ StreamText result
.toTextStreamResponse()  →  SSE to client
    ↓ assistant final message contains
<report>{ ... JSON ... }</report>
    ↓ parsed by
lib/report/generateReport.ts → parseReportFromText()
```

---

## Domain Layer Reference

```
types/
  agent.ts        ChatMessage, ToolCall, AgentState
  claims.ts       ClaimType, DocumentType, DocumentStatus, Document, Claim
  policy.ts       PolicyStatus, Coverage, Exclusion, Policy
  report.ts       Recommendation, AssessmentReport + 6 section interfaces

lib/data/
  policies.ts     POLICIES + getPolicyById()
  documents.ts    DOCUMENTS + getDocumentById() + getDocumentsByClaimId()
  medicalCodes.ts MEDICAL_NECESSITY_RULES + findNecessityRule()
  claims.ts       CLAIMS + getClaimById()  (3 test scenarios)

lib/tools/
  lookupPolicy.ts           lookupPolicy(input) → Policy | error
  calculateBenefit.ts       calculateBenefit(input) → amounts | error
  verifyDocument.ts         verifyDocument(input) → validity + issues | error
  checkMedicalNecessity.ts  checkMedicalNecessity(input) → necessity + rationale

lib/agent/
  prompts.ts  SYSTEM_PROMPT (workflow + anti-hallucination + <report> format)
  tools.ts    agentTools (4 tools with inputSchema + execute, AI SDK v6)
  agent.ts    runAgent(messages) → streamText result

lib/report/
  generateReport.ts  parseReportFromText(text) → AssessmentReport | null

app/api/agent/
  route.ts  POST handler → runAgent → toTextStreamResponse()

__tests__/
  scenario-a-approval.test.ts   (5 tests)
  scenario-b-rejection.test.ts  (5 tests)
  scenario-c-more-info.test.ts  (5 tests)
  report.test.ts                (7 tests — parseReportFromText)
```
