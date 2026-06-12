# Changelog

## 2026-06-12

### Added — Domain Layer

**Types** (`types/`)
- `agent.ts` — `ChatMessage`, `ToolCall`, `AgentState`
- `claims.ts` — `ClaimType`, `DocumentType`, `DocumentStatus`, `Document`, `Claim`
- `policy.ts` — `PolicyStatus`, `Coverage`, `Exclusion`, `Policy`
- `report.ts` — `Recommendation`, `AssessmentReport` and all 6 section interfaces

**Mock Data** (`lib/data/`)
- `policies.ts` — 3 mock policies (POL-001 full coverage, POL-002 elective exclusion, POL-003 standard plus)
- `documents.ts` — 6 mock documents covering all 3 test scenarios (including 1 missing document)
- `medicalCodes.ts` — ICD/CPT necessity rules for appendicitis, cosmetic procedures, and fractures
- `claims.ts` — 3 test scenario claims (CLM-001, CLM-002, CLM-003)

**Tool Implementations** (`lib/tools/`)
- `lookupPolicy.ts` — looks up policy by ID; returns typed `Policy` or error
- `calculateBenefit.ts` — exclusion check → coverage lookup → deductible → coverage % → cap at maxBenefit
- `verifyDocument.ts` — validates document status and returns issues list
- `checkMedicalNecessity.ts` — matches diagnosis to necessity rules; identifies unapproved procedures

### Added — Agent Core

**Agent** (`lib/agent/`)
- `prompts.ts` — `SYSTEM_PROMPT` with strict workflow order (verify docs → policy → necessity → benefit), anti-hallucination rules, `<report>` JSON format
- `tools.ts` — `agentTools` wrapping all 4 tool functions with Zod `inputSchema` (AI SDK v6 API)
- `agent.ts` — `runAgent(messages)` using `streamText`, `stopWhen: stepCountIs(10)`, and `onStepFinish` logging

**Report** (`lib/report/`)
- `generateReport.ts` — `parseReportFromText(text)` extracts `<report>…</report>` JSON block

**API Route** (`app/api/agent/`)
- `route.ts` — `POST /api/agent` streaming endpoint; returns `toTextStreamResponse()`

### Added — Tests

- `vitest.config.ts` — Vitest config with `@/` path alias resolution
- `__tests__/scenario-a-approval.test.ts` — 5 tests: Approval scenario (CLM-001, POL-001)
- `__tests__/scenario-b-rejection.test.ts` — 5 tests: Rejection scenario (CLM-002, POL-002)
- `__tests__/scenario-c-more-info.test.ts` — 5 tests: More Info scenario (CLM-003, POL-003)
- `__tests__/report.test.ts` — 7 tests: `parseReportFromText` edge cases

### Fixed — AI SDK v6 Compatibility
- `parameters` → `inputSchema` in all tool definitions (breaking change in AI SDK v6)
- `maxSteps` → `stopWhen: stepCountIs(10)` (breaking change in AI SDK v6)
- `toDataStreamResponse()` → `toTextStreamResponse()` (breaking change in AI SDK v6)
- `call.args` → `call.toolName` in `onStepFinish` callback (field renamed in AI SDK v6)

### Verified
- `npx tsc --noEmit` — 0 errors (strict mode)
- `npx vitest run` — 26/26 tests passing

### Added — Initial Project Setup (earlier)
- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (`AGENTS.md`)
- Architecture design (`SYSTEM_MAP.md`, `PROJECT_STATE.md`)
