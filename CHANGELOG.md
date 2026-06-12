# Changelog

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
