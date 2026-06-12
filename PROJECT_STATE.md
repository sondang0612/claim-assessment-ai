# Project State

## Status: Planning Complete — Ready to Implement

---

## Completed

- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (AGENTS.md)
- Architecture design (SYSTEM_MAP.md)
- Folder structure definition
- Implementation plan + task breakdown

---

## In Progress

- (nothing — planning phase complete)

---

## Todo

### Phase 1 — Foundation
- [ ] **T1** — TypeScript type definitions  
  Files: `types/agent.ts`, `types/claims.ts`, `types/policy.ts`, `types/report.ts`  
  Defines: ChatMessage, ToolCall, Claim, Policy, Coverage, AssessmentReport, Recommendation

- [ ] **T2** — Mock data layer  
  Files: `lib/data/policies.ts`, `lib/data/documents.ts`, `lib/data/medicalCodes.ts`  
  Content: 3 policies (POL-001 full, POL-002 elective-exclusion, POL-003 standard), documents per claim, ICD/CPT rules

### Phase 2 — Tool Layer
- [ ] **T3** — Implement 4 tool functions  
  Files: `lib/tools/lookupPolicy.ts`, `lib/tools/calculateBenefit.ts`, `lib/tools/verifyDocument.ts`, `lib/tools/checkMedicalNecessity.ts`  
  Each queries mock data and returns typed results; no external calls

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
  Extracts `<report>…</report>` JSON block from final assistant message

### Phase 5 — UI
- [ ] **T9** — Chat components  
  Files: `components/chat/ChatContainer.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `ChatInput.tsx`, `ToolCallLog.tsx`  
  ChatContainer manages state; streams via fetch + ReadableStream; passes chunks to child components

- [ ] **T10** — Report components  
  Files: `components/report/AssessmentReport.tsx`, `ReportSection.tsx`, `RecommendationBadge.tsx`  
  Renders parsed AssessmentReport JSON; badge is color-coded (green/red/yellow)

- [ ] **T11** — Page integration  
  File: `app/page.tsx`  
  Mounts `<ChatContainer />`; removes Next.js boilerplate

### Phase 6 — Validation
- [ ] **T12** — Manual test of 3 scenarios  
  Scenario A: Approval (POL-001, appendicitis)  
  Scenario B: Rejection (POL-002, elective cosmetic)  
  Scenario C: More Info (POL-003, missing document)

- [ ] **T13** — TypeScript + ESLint clean pass  
  `npm run build` passes with zero TS errors  
  `npm run lint` passes with zero ESLint errors

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

## Architecture Overview

```
Browser
  └─ ChatContainer (state)
      ├─ MessageList → MessageBubble
      ├─ ToolCallLog
      └─ AssessmentReport → ReportSection + RecommendationBadge

Server
  └─ POST /api/agent/route.ts
      └─ lib/agent/agent.ts  (streamText + tools)
          ├─ lib/agent/prompts.ts
          ├─ lib/agent/tools.ts  (Zod schemas)
          └─ lib/tools/*.ts  →  lib/data/*.ts

Types
  └─ types/{agent,claims,policy,report}.ts
```

---

## Test Scenario Data

| Scenario | Claim ID | Policy | Key Trigger | Expected Outcome |
|---|---|---|---|---|
| Approval | CLM-001 | POL-001 | All docs valid, appendicitis | APPROVED — $4,500 benefit |
| Rejection | CLM-002 | POL-002 | Elective procedure exclusion | REJECTED — not medically necessary |
| More Info | CLM-003 | POL-003 | Missing itemized bill (DOC-003) | MORE_INFO_REQUIRED |
