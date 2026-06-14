# Claim Assessment AI

An AI-assisted medical insurance claim adjudication system built for Papaya Insurtech.

Accepts natural-language claim submissions, runs a deterministic four-step assessment pipeline in real time, and produces audit-grade reports where every approval and rejection is traceable to a specific named policy clause — with zero LLM involvement in any business decision.

---

## Live Demo

**[→ Launch Application](https://claim-assessment-ai.vercel.app)**

## System Prompt & Tool Design Decisions

### System prompt

The LLM is given one responsibility: **field extraction only**. The system prompt (`lib/parser/claimParser.ts`) reads:

```
You are a claim data extractor for an insurance company.
Extract all insurance claim fields from the user message and return ONLY a valid JSON object.

Required JSON structure:
{
  "claimId": "string (e.g. CLM-001)",
  "policyId": "string (e.g. POL-001)",
  "patientName": "string",
  "documentIds": ["string (e.g. DOC-001)"],
  "claimType": "hospitalization | surgery | outpatient | emergency | preventive | elective",
  "diagnosis": "string",
  "procedures": ["string (CPT codes)"],
  "requestedAmount": number
}

Return ONLY the JSON object. No markdown code fences. No commentary.
```

The model returns a raw JSON string. The application strips any markdown fences, parses it with `JSON.parse()`, and validates the shape with Zod (`ParsedClaimSchema.parse()`). If either step throws, the error propagates to the SSE stream as `{ type: "error" }`. The LLM never sees the policy database, the document store, or any business rules.

> **Why not `generateObject()`?** DeepSeek rejects `response_format: json_schema` with HTTP 400. Using `generateText()` + `JSON.parse()` + Zod achieves the same guarantee without SDK-level support.

### LLM boundary

Every message first passes through `classifyRequest()` — a pure regex function with zero LLM cost. Only messages classified as `claim_request` reach the parser. Greetings, help requests, and unsupported messages receive static responses instantly.

The LLM is **never consulted for**:

- Whether a document is valid
- Whether a policy is active or has exclusions
- Whether a diagnosis is medically necessary
- What the benefit amount should be
- What the final recommendation is

These are all computed in TypeScript from structured data.

### Tool design decisions

#### `verifyDocument`

Looks up a document by ID from the static `DOCUMENTS` record and returns its `valid` boolean, `documentType`, `provider`, `issuedDate`, and `issues[]`. Returns a discriminated union (`success: true | false`) so callers must handle the not-found case explicitly.

**Why deterministic:** Validity is a data property (`status === 'valid'`), not a judgment. LLM involvement would add latency and non-determinism to a binary check.

#### `lookupPolicy`

Fetches a full `Policy` object — including `coverages[]`, `exclusions[]`, `coverageClauses[]`, and `annualDeductibleMet` — from the static `POLICIES` record. Returns the entire policy rather than a summary so the caller (workflow or `ClaimDataManager`) can evaluate any field without a second lookup.

**Why deterministic:** Policy terms are structured contract data. An LLM interpreting policy text would introduce ambiguity; the source data is already machine-readable.

#### `checkMedicalNecessity`

Matches the diagnosis string against `MEDICAL_NECESSITY_RULES` using case-insensitive substring matching, then computes `unapprovedProcedures` by diffing the requested CPT codes against the rule's `approvedProcedures[]`. Always returns an object (never throws) — if no rule matches, it returns `necessary: false` with a rationale requesting manual clinical review.

**Why deterministic:** Medical necessity rules are predefined clinical policies, not open-ended clinical judgment. Using an LLM here would make identical diagnoses produce different results across runs — unacceptable for adjudication.

#### `calculateBenefit`

Applies the coverage formula in pure arithmetic: subtract the per-claim deductible (if `annualDeductibleMet` is false), multiply by `coveragePercent`, cap at `maxBenefit`. Returns itemized figures (`coveredAmount`, `patientResponsibility`, `deductibleApplied`, `coveragePercent`) so the report can display a full breakdown with no post-processing.

**Why deterministic:** Benefit calculation is arithmetic on policy data. Every reviewer running the same claim must see the same numbers. Non-determinism here would be a compliance failure.

### Why decisions are not delegated to the LLM

Insurance adjudication requires **reproducibility**: the same claim submitted twice must produce the same recommendation. It also requires **auditability**: every approval and rejection must be traceable to a specific clause in the policy document, not to the model's internal reasoning.

Delegating decisions to an LLM violates both properties:

- Temperature and sampling make identical inputs produce different outputs
- There is no reliable way to guarantee a named `clauseId` in model output

The design keeps the LLM in the role where it excels — understanding natural language — and keeps the rules engine in TypeScript where determinism and auditability are guaranteed by construction.

---

## Test Cases, Agent Outputs & Tool Call Logs

The three built-in scenarios cover every possible outcome path. Outputs below are derived directly from `streamAssessmentWorkflow()` — the exact strings the typewriter animation types into the chat window.

---

### Scenario A — APPROVED (CLM-001)

**Input**

```
Please assess claim CLM-001 for John Doe.
Policy: POL-001. Claim type: surgery. Diagnosis: appendicitis (K37).
Procedures: CPT 44970 (laparoscopic appendectomy). Requested amount: $5,000.
Documents to verify: DOC-001 (discharge summary), DOC-002 (itemized bill).
```

**Tool Call Log**

| #   | Tool                    | Input                                                         | Result                                                  |
| --- | ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `verifyDocument`        | `{ documentId: "DOC-001" }`                                   | `valid` · discharge summary · City General Hospital     |
| 2   | `verifyDocument`        | `{ documentId: "DOC-002" }`                                   | `valid` · itemized bill · City General Hospital         |
| 3   | `lookupPolicy`          | `{ policyId: "POL-001" }`                                     | active · John Doe · expires 2026-12-31 · deductible met |
| 4   | `checkMedicalNecessity` | `{ diagnosis: "appendicitis", procedures: ["44970"] }`        | `necessary: true` · approved CPT: 44950, 44960, 44970   |
| 5   | `calculateBenefit`      | `{ policyId: "POL-001", claimType: "surgery", amount: 5000 }` | covered $4,500 · 90% · deductible $0                    |

**Streamed narration (chat window)**

```
## Step 1: Document Verification
✓ DOC-001 · discharge summary · City General Hospital — valid
✓ DOC-002 · itemized bill · City General Hospital — valid

## Step 2: Policy Verification
✓ Policy POL-001 active — John Doe (expires 2026-12-31)
  annual deductible met
✓ surgery coverage: 90% up to $30,000 (deductible $500) · pre-authorization required
  CV-02: "Surgical procedures covered at 90% up to $30,000. Pre-authorization required."

## Step 3: Medical Necessity
Diagnosis: appendicitis
✓ Medical necessity established
  Appendectomy is a medically necessary emergency surgical procedure for acute appendicitis.
  Approved CPT codes: 44950, 44960, 44970
  Requested procedure(s): 44970

## Step 4: Benefit Calculation
✓ Benefit calculated · CV-02
  Requested:            $5,000
  Coverage:             90%
  Deductible applied:   $0
  → Covered amount:     $4,500
  → Patient responsibility: $500

---

## Final Assessment: APPROVED

All claim assessment criteria have been satisfied.

1. Documents  [PASS] — All 2 document(s) verified (DOC-001 (discharge summary), DOC-002 (itemized bill))
2. Policy     [PASS] — Coverage confirmed — CV-02: "Surgical procedures covered at 90% up to $30,000. Pre-authorization required."
3. Medical    [PASS] — Medical necessity confirmed for "appendicitis" — Appendectomy is a medically necessary emergency surgical procedure for acute appendicitis.
4. Benefit    [PASS] — Covered $4,500 at 90% (deductible $0 applied; patient responsibility $500)

Policy Citation: CV-02 — "Surgical procedures covered at 90% up to $30,000. Pre-authorization required."
```

---

### Scenario B — REJECTED (CLM-002)

**Input**

```
Please assess claim CLM-002 for Jane Smith.
Policy: POL-002. Claim type: elective. Diagnosis: elective cosmetic surgery (Z41.1).
Procedures: CPT 15829 (rhytidectomy). Requested amount: $8,000.
Documents to verify: DOC-004 (medical bill), DOC-005 (referral).
```

**Tool Call Log**

| #   | Tool                    | Input                                                               | Result                                                      |
| --- | ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `verifyDocument`        | `{ documentId: "DOC-004" }`                                         | `valid` · medical bill · Aesthetic Clinic                   |
| 2   | `verifyDocument`        | `{ documentId: "DOC-005" }`                                         | `valid` · referral · Primary Care Associates                |
| 3   | `lookupPolicy`          | `{ policyId: "POL-002" }`                                           | active · Jane Smith · exclusion EX-01 applies to `elective` |
| 4   | `checkMedicalNecessity` | `{ diagnosis: "elective cosmetic surgery", procedures: ["15829"] }` | `necessary: false`                                          |
| —   | `calculateBenefit`      | —                                                                   | **not called** — claim rejected before Step 4               |

**Streamed narration (chat window)**

```
## Step 1: Document Verification
✓ DOC-004 · medical bill · Aesthetic Clinic — valid
✓ DOC-005 · referral · Primary Care Associates — valid

## Step 2: Policy Verification
✓ Policy POL-002 active — Jane Smith (expires 2026-02-28)
  annual deductible not yet met
✗ Claim type "elective" excluded under EX-01
  "Elective and cosmetic procedures are not covered under this plan."

## Step 3: Medical Necessity
Diagnosis: elective cosmetic surgery
✗ Medical necessity not established
  Elective cosmetic surgery is not medically necessary.

---

## Final Assessment: REJECTED

Claim denied. A policy exclusion applies to this claim type.

1. Documents  [PASS] — All 2 document(s) verified (DOC-004 (medical bill), DOC-005 (referral))
2. Policy     [FAIL] — Excluded under EX-01: "Elective and cosmetic procedures are not covered under this plan."
3. Medical    [FAIL] — Not established for "elective cosmetic surgery" — Elective cosmetic surgery is not medically necessary.
4. Benefit    [N/A ] — Not applicable

Policy Citation: EX-01 — "Elective and cosmetic procedures are not covered under this plan."
```

---

### Scenario C — MORE INFO REQUIRED (CLM-003)

**Input**

```
Please assess claim CLM-003 for Bob Johnson.
Policy: POL-003. Claim type: surgery. Diagnosis: femoral fracture (S72.001A).
Procedures: CPT 27244 (ORIF femur). Requested amount: $12,000.
Documents to verify: DOC-006 (discharge summary), DOC-003 (itemized bill).
```

**Tool Call Log**

| #   | Tool                    | Input                                              | Result                                             |
| --- | ----------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 1   | `verifyDocument`        | `{ documentId: "DOC-006" }`                        | `valid` · discharge summary · Metro Medical Center |
| 2   | `verifyDocument`        | `{ documentId: "DOC-003" }`                        | `valid: false` · itemized bill · **missing**       |
| 3   | `lookupPolicy`          | `{ policyId: "POL-003" }`                          | active · Bob Johnson · surgery 85%/$25k (CV-07)    |
| 4   | `checkMedicalNecessity` | `{ diagnosis: "fracture", procedures: ["27244"] }` | `necessary: true` · approved CPT: 27244, 27245     |
| —   | `calculateBenefit`      | —                                                  | **not called** — missing document halts approval   |

> `lookupPolicy` and `checkMedicalNecessity` still run (all steps execute regardless of document status) to populate the full report. The final decision is `MORE_INFO_REQUIRED` because document validity is evaluated first.

**Streamed narration (chat window)**

```
## Step 1: Document Verification
✓ DOC-006 · discharge summary · Metro Medical Center — valid
✗ DOC-003 · itemized bill — not valid
   ↳ Itemized bill has not been submitted. Required for all surgical claims under Section 3.1.

## Step 2: Policy Verification
✓ Policy POL-003 active — Bob Johnson (expires 2026-05-31)
  annual deductible not yet met
✓ surgery coverage: 85% up to $25,000 (deductible $750) · pre-authorization required
  CV-07: "Surgical procedures covered at 85% up to $25,000. Itemized bill required (Section 3.1)."

## Step 3: Medical Necessity
Diagnosis: fracture
✓ Medical necessity established
  Surgical repair of a fracture is medically necessary.
  Approved CPT codes: 27244, 27245
  Requested procedure(s): 27244

---

## Final Assessment: MORE INFORMATION REQUIRED

Assessment on hold. Required documentation is missing or invalid.

1. Documents  [FAIL] — 1 of 2 document(s) not valid — DOC-003
2. Policy     [PASS] — Coverage confirmed — CV-07: "Surgical procedures covered at 85% up to $25,000. Itemized bill required (Section 3.1)."
3. Medical    [PASS] — Medical necessity confirmed for "fracture" — Surgical repair of a fracture is medically necessary.
4. Benefit    [N/A ] — Not applicable

Policy Citation: CV-07 — "Surgical procedures covered at 85% up to $25,000. Itemized bill required (Section 3.1)."
```

---

## Test Coverage

9 suites, run with `npm test`.

| Suite                  | What is verified                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `scenario-a-approval`  | CLM-001 each tool step; covered = \$4,500; `deductibleApplied` = \$0                       |
| `scenario-b-rejection` | CLM-002 exclusion presence; `necessary` = false; `calculateBenefit` returns excluded error |
| `scenario-c-more-info` | CLM-003 DOC-003 `valid` = false; POL-003 surgery 85%; hypothetical benefit = \$9,562.50    |
| `claim-flow`           | Full tool sequence for all 3 scenarios; derived recommendation matches expected            |
| `report`               | `runAssessmentWorkflow` report shape, field values, tool call log order and statuses       |
| `report-citations`     | `policyCitations` correct clauseIds; no fabricated text; financial figures round-trip      |
| `tool-execution`       | Edge cases: unknown IDs, deductible math, maxBenefit cap, unapproved procedures            |
| `request-classifier`   | 37 patterns: claim_request (10), greeting (14), help_request (8), unsupported (5)          |
| `provider-deepseek`    | Provider shape, baseURL constant, model IDs, no API calls made                             |

---

## License

Internal use — Papaya Insurtech.
