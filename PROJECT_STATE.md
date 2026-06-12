# Project State

## Status: All Phases Complete — Build + Lint Passing

---

## Completed

- Next.js 16 + Tailwind CSS v4 scaffolding
- Requirements analysis (AGENTS.md)
- Architecture design (SYSTEM_MAP.md)
- Folder structure definition + implementation plan
- **T1** — TypeScript type definitions (`types/`)
- **T2** — Mock data layer (`lib/data/`)
- **T3** — 4 tool function implementations (`lib/tools/`)
- **T4** — AI SDK v6 tool schemas (`lib/agent/tools.ts`)
- **T5** — System prompt with workflow + report format (`lib/agent/prompts.ts`)
- **T6** — Agent runner with streaming + tool logging (`lib/agent/agent.ts`)
- **T7** — Streaming API route — custom SSE from `fullStream` (`app/api/agent/route.ts`)
- **T8** — Report parser (`lib/report/generateReport.ts`)
- **Migration** — Anthropic → DeepSeek provider (`lib/providers/deepseek.ts`)
- **T9** — Chat components (`components/chat/`)
- **T10** — Report components (`components/report/`)
- **T11** — Page integration (`app/page.tsx`)
- **T12** — All test scenarios (77 tests, 8 files, all passing)
- **T13** — TypeScript + ESLint + Build all clean (0 errors)

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
| Tool calling | Supported by both models |

### Model selection

The API route accepts an optional `model` field in the request body:

```json
{ "messages": [...], "model": "deepseek-reasoner" }
```

Defaults to `deepseek-chat` if omitted or invalid.

---

## Installed Dependencies

```
ai@6.0.203             Vercel AI SDK (streamText, stepCountIs, tool)
@ai-sdk/openai@3.0.71  OpenAI-compatible provider → used for DeepSeek
@ai-sdk/anthropic@3    Retained but no longer used (can be removed)
zod@4.4.3              Schema validation for tool inputSchema
vitest@4.1.8           Test runner
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI provider | DeepSeek via `@ai-sdk/openai` | OpenAI-compatible API; no separate SDK needed |
| Base URL | `https://api.deepseek.com` | DeepSeek's API endpoint |
| Provider method | `.chat()` | Maps to `/v1/chat/completions` (not OpenAI responses API) |
| Tool schema | `inputSchema` via Zod (AI SDK v6) | Breaking change from v4/v5 `parameters` |
| Multi-step | `stopWhen: stepCountIs(10)` | Replaced `maxSteps` in SDK v6 |
| Streaming | `toTextStreamResponse()` | Replaced `toDataStreamResponse()` in SDK v6 |
| Report format | `<report>` XML tag in assistant text | Provider-agnostic; works with any model |
| Model default | `deepseek-chat` | General-purpose; reasoner for complex cases |

---

## Test Results

```
Test Files: 8 passed
Tests:      77 passed
```

| File | Tests | Coverage |
|---|---|---|
| `scenario-a-approval.test.ts` | 5 | CLM-001 — docs valid, POL-001, appendicitis → APPROVED |
| `scenario-b-rejection.test.ts` | 5 | CLM-002 — elective excluded, not necessary → REJECTED |
| `scenario-c-more-info.test.ts` | 5 | CLM-003 — missing itemized bill → MORE_INFO_REQUIRED |
| `report.test.ts` | 7 | parseReportFromText — valid, edge cases, all 3 recommendations |
| `provider-deepseek.test.ts` | 11 | DeepSeek provider config, model selection, LanguageModelV3 shape |
| `claim-flow.test.ts` | 14 | End-to-end tool chain for all 3 scenarios + recommendation derivation |
| `tool-execution.test.ts` | 21 | Edge cases: unknown IDs, deductible math, maxBenefit cap, unapproved procedures |
| `report-citations.test.ts` | 9 | Report round-trip, citation text from policy data, multi-citation order |

---

## Architecture

```
POST /api/agent  { messages, model? }
    ↓ runAgent(messages, model)
lib/agent/agent.ts
    → streamText(getDeepSeekModel(model), system, messages, tools, stopWhen: stepCountIs(10))
    → onStepFinish: console.log tool calls per step
    ↓ model
lib/providers/deepseek.ts
    → createOpenAI({ name:'deepseek', baseURL:'https://api.deepseek.com', apiKey:DEEPSEEK_API_KEY })
    → .chat('deepseek-chat' | 'deepseek-reasoner')
    ↓ tool calls
lib/agent/tools.ts  (inputSchema + execute, AI SDK v6)
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
