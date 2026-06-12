# Changelog

## 2026-06-12

### Added

- Initial project setup (Next.js 16 + Tailwind CSS v4 scaffolding)
- Requirements analysis (`AGENTS.md`)
- Architecture design and folder structure (`SYSTEM_MAP.md`, `PROJECT_STATE.md`)

### Added — Domain Layer

**Types** (`types/`)
- `agent.ts` — `ChatMessage`, `ToolCall`, `AgentState`
- `claims.ts` — `ClaimType`, `DocumentType`, `DocumentStatus`, `Document`, `Claim`
- `policy.ts` — `PolicyStatus`, `Coverage`, `Exclusion`, `Policy`
- `report.ts` — `Recommendation`, `AssessmentReport` and all section interfaces

**Mock Data** (`lib/data/`)
- `policies.ts` — 3 mock policies (POL-001 full coverage, POL-002 elective exclusion, POL-003 standard plus)
- `documents.ts` — 6 mock documents covering all 3 test scenarios (including 1 missing document)
- `medicalCodes.ts` — ICD/CPT necessity rules for appendicitis, cosmetic procedures, and fractures
- `claims.ts` — 3 test scenario claims (CLM-001, CLM-002, CLM-003)

**Tool Implementations** (`lib/tools/`)
- `lookupPolicy.ts` — looks up policy by ID; returns typed `Policy` or error
- `calculateBenefit.ts` — computes covered amount, patient responsibility, deductible; handles exclusions
- `verifyDocument.ts` — validates document status and returns issues list
- `checkMedicalNecessity.ts` — matches diagnosis to necessity rules; identifies unapproved procedures

### Verified
- `npx tsc --noEmit` passes with zero errors (strict mode)
