# Project State

## Status: Refactor Complete — Application-Driven Workflow

---

## Completed

- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (AGENTS.md)
- Architecture design (SYSTEM_MAP.md)
- Folder structure definition + implementation plan
- **T1** — TypeScript type definitions (`types/`)
- **T2** — Mock data layer (`lib/data/`)
- **T3** — 4 tool function implementations (`lib/tools/`)
- **T4** — AI SDK v6 tool schemas (`lib/agent/tools.ts`) *(removed in refactor)*
- **T5** — System prompt with workflow + report format (`lib/agent/prompts.ts`) *(removed in refactor)*
- **T6** — Agent runner with streaming + tool logging (`lib/agent/agent.ts`) *(removed in refactor)*
- **T7** — Streaming API route — custom SSE from `fullStream` *(replaced with JSON route)*
- **T8** — Report parser (`lib/report/generateReport.ts`) *(removed in refactor)*
- **Migration** — Anthropic → DeepSeek provider (`lib/providers/deepseek.ts`)
- **T9** — Chat components (`components/chat/`)
- **T10** — Report components (`components/report/`)
- **T11** — Page integration (`app/page.tsx`)
- **T12** — All test scenarios (85 tests, 8 files, all passing)
- **T13** — TypeScript + ESLint + Build all clean (0 errors)
- **T14** — Refactor: LLM-driven → application-driven workflow
  - `lib/parser/claimParser.ts` — LLM extracts structured claim fields only
  - `lib/workflow/assessmentWorkflow.ts` — deterministic 4-step workflow
  - Deleted `lib/agent/` (agent.ts, prompts.ts, tools.ts)
  - Deleted `lib/report/generateReport.ts`
  - Updated API route to return JSON (not SSE stream)
  - Updated ChatContainer to use JSON fetch (not SSE reader)

---

## In Progress

- (nothing)

---

## Todo

- (nothing)

---

## Environment Variables

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

Set in `.env.local` for local development. Required at runtime; not needed to run tests.

---

## AI Provider — DeepSeek via @ai-sdk/openai

| Setting | Value |
|---|---|
| Package | `@ai-sdk/openai@3.0.71` |
| Base URL | `https://api.deepseek.com` |
| Default model | `deepseek-chat` |
| Reasoning model | `deepseek-reasoner` |
| Endpoint used | `.chat()` → `/v1/chat/completions` |
| AI SDK usage | `generateText()` only (no `streamText`, no tool calls) |

### Model selection

The API route accepts an optional `model` field in the request body:

```json
{ "messages": [...], "model": "deepseek-reasoner" }
```

Defaults to `deepseek-chat` if omitted or invalid. The model is passed to `parseClaim()` only.

---

## Installed Dependencies

```
ai@6.0.203             Vercel AI SDK (generateText, generateObject)
@ai-sdk/openai@3.0.71  OpenAI-compatible provider → used for DeepSeek
zod@4.4.3              Schema validation for ParsedClaimSchema
vitest@4.1.8           Test runner
```

---

## Architecture — Application-Driven Workflow

```
POST /api/agent  { messages, model? }
    ↓ parseClaim(lastUserMessage, model)
lib/parser/claimParser.ts
    → generateText(system=PARSER_SYSTEM, prompt=userMessage)
    → JSON.parse(text) + ParsedClaimSchema.parse()
    ↓ ParsedClaim
    ↓ runAssessmentWorkflow(parsedClaim)
lib/workflow/assessmentWorkflow.ts
    → verifyDocument() × N  (pure TypeScript)
    → lookupPolicy()         (pure TypeScript)
    → checkMedicalNecessity()(pure TypeScript)
    → decision rules in TypeScript
    → calculateBenefit()     (only if APPROVED)
    → builds AssessmentReport in code
    ↓ { report, toolCalls, summary }
Response.json(result)
```

### LLM Responsibility

- **Only**: extract structured claim fields (claimId, policyId, documentIds, claimType, diagnosis, procedures, requestedAmount) from a natural language user message.
- **Not**: tool calling, business decisions, workflow orchestration, report generation.

### Application Responsibility

- Execute all 4 domain tools deterministically in fixed sequence.
- Apply all business rules (document validity, policy exclusions, medical necessity, benefit calculation) in TypeScript.
- Build the full `AssessmentReport` in code.

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI provider | DeepSeek via `@ai-sdk/openai` | OpenAI-compatible API; no separate SDK needed |
| LLM call | `generateText()` | DeepSeek rejects `json_schema` response_format used by `generateObject()` |
| JSON extraction | `JSON.parse + Zod.parse` | Safe validation after `generateText()` plain text response |
| Workflow | Deterministic TypeScript | No hallucination risk; fully testable without API |
| Report building | In-code TypeScript | Deterministic output; policy citations from structured data |
| API response | JSON (not SSE) | No streaming needed when workflow is synchronous |
| Tool calls | Plain TypeScript functions | No AI SDK wrappers needed in application-driven flow |

---

## Test Results

```
Test Files: 8 passed
Tests:      85 passed
```

| File | Tests | Coverage |
|---|---|---|
| `scenario-a-approval.test.ts` | 5 | CLM-001 — docs valid, POL-001, appendicitis → APPROVED |
| `scenario-b-rejection.test.ts` | 5 | CLM-002 — elective excluded, not necessary → REJECTED |
| `scenario-c-more-info.test.ts` | 6 | CLM-003 — missing itemized bill → MORE_INFO_REQUIRED |
| `report.test.ts` | 11 | runAssessmentWorkflow — all 3 scenarios, report structure |
| `provider-deepseek.test.ts` | 11 | DeepSeek provider config, model selection, LanguageModelV3 shape |
| `claim-flow.test.ts` | 14 | End-to-end tool chain for all 3 scenarios + recommendation derivation |
| `tool-execution.test.ts` | 21 | Edge cases: unknown IDs, deductible math, maxBenefit cap, unapproved procedures |
| `report-citations.test.ts` | 9 | Workflow citation output + citation source data validation |
