# Project State

## Status: Phase 1–2 Complete — Agent Core Next

---

## Completed

- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (AGENTS.md)
- Architecture design (SYSTEM_MAP.md)
- Folder structure definition
- Implementation plan + task breakdown
- **T1** — TypeScript type definitions (`types/`)
- **T2** — Mock data layer (`lib/data/`)
- **T3** — 4 tool function implementations (`lib/tools/`)

---

## In Progress

- (nothing — ready for Phase 3)

---

## Todo

### Phase 2 — Tool Layer
- [x] **T1** — TypeScript type definitions  
  `types/agent.ts`, `types/claims.ts`, `types/policy.ts`, `types/report.ts`

- [x] **T2** — Mock data layer  
  `lib/data/policies.ts` (3 policies), `lib/data/documents.ts`, `lib/data/medicalCodes.ts`, `lib/data/claims.ts`

- [x] **T3** — 4 tool function implementations  
  `lib/tools/lookupPolicy.ts`, `lib/tools/calculateBenefit.ts`, `lib/tools/verifyDocument.ts`, `lib/tools/checkMedicalNecessity.ts`

- [ ] **T4** — Vercel AI SDK tool schemas  
  File: `lib/agent/tools.ts`  
  Wraps each tool function with `tool({ description, parameters: z.object(…), execute })` using Zod

### Phase 3 — Agent Core
- [ ] **T5** — System prompt  
  File: `lib/agent/prompts.ts`  
  Instructs Claude: role, assessment workflow order, mandatory `<report>` JSON format at end of final response

- [ ] **T6** — Agent runner  
  File: `lib/agent/agent.ts`  
  Exports `runAgent(messages)` → calls `streamText({ model, system, messages, tools, maxSteps: 10 })`; returns stream

- [ ] **T7** — Streaming API route  
  File: `app/api/agent/route.ts`  
  POST handler: parses `{ messages }` body → calls `runAgent` → returns `result.toDataStreamResponse()`

### Phase 4 — Report
- [ ] **T8** — Report parser  
  File: `lib/report/generateReport.ts`  
  Exports `parseReportFromText(text: string): AssessmentReport | null`

### Phase 5 — UI
- [ ] **T9** — Chat components  
  `components/chat/` — ChatContainer, MessageList, MessageBubble, ChatInput, ToolCallLog

- [ ] **T10** — Report components  
  `components/report/` — AssessmentReport, ReportSection, RecommendationBadge

- [ ] **T11** — Page integration  
  `app/page.tsx`

### Phase 6 — Validation
- [ ] **T12** — Manual test of 3 scenarios (Approval / Rejection / More Info)
- [ ] **T13** — TypeScript + ESLint clean pass

---

## Dependencies to Install

```bash
npm install ai @ai-sdk/anthropic zod
```

| Package | Purpose |
|---|---|
| `ai` | Vercel AI SDK — `streamText`, `tool`, `DataStreamResponse` |
| `@ai-sdk/anthropic` | Anthropic provider for Vercel AI SDK |
| `zod` | Runtime schema validation for tool parameters |

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI provider | Anthropic Claude (`claude-sonnet-4-6`) | Tool use + structured output |
| AI SDK | Vercel AI SDK (`ai`) | SSE streaming built into App Router |
| Tool schema | Zod via `tool()` wrapper | Type-safe, validated at runtime |
| Report extraction | `<report>` XML tag in assistant text | Simple to parse, no extra API call |
| State management | React `useState` / `useReducer` | No external lib needed |
| Mock data | In-memory TypeScript objects | No DB required for agent demo |
| Streaming transport | `result.toDataStreamResponse()` | Native SSE, works with App Router |

---

## Test Scenario Data

| Scenario | Claim ID | Policy | Key Trigger | Expected Outcome |
|---|---|---|---|---|
| Approval | CLM-001 | POL-001 | All docs valid, appendicitis | APPROVED — $4,500 benefit |
| Rejection | CLM-002 | POL-002 | Elective procedure exclusion | REJECTED — not medically necessary |
| More Info | CLM-003 | POL-003 | Missing itemized bill (DOC-003) | MORE_INFO_REQUIRED |

---

## Domain Layer — File Reference

```
types/
  agent.ts        ChatMessage, ToolCall, AgentState
  claims.ts       ClaimType, DocumentType, DocumentStatus, Document, Claim
  policy.ts       PolicyStatus, Coverage, Exclusion, Policy
  report.ts       Recommendation, AssessmentReport + section interfaces

lib/data/
  policies.ts     POLICIES record + getPolicyById()
  documents.ts    DOCUMENTS record + getDocumentById() + getDocumentsByClaimId()
  medicalCodes.ts MEDICAL_NECESSITY_RULES + findNecessityRule()
  claims.ts       CLAIMS record + getClaimById()  (3 test scenarios)

lib/tools/
  lookupPolicy.ts           lookupPolicy(input) → Policy | error
  calculateBenefit.ts       calculateBenefit(input) → amounts | error
  verifyDocument.ts         verifyDocument(input) → validity + issues | error
  checkMedicalNecessity.ts  checkMedicalNecessity(input) → necessity + rationale
```
