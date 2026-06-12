# Changelog

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
