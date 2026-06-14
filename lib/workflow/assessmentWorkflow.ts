import { ClaimDataManager } from '@/lib/domain/ClaimDataManager';
import type { CalculateBenefitResult } from '@/lib/domain/ClaimDataManager';
import type { ParsedClaim } from '@/lib/parser/claimParser';
import type { AssessmentReport, DecisionFactor, PolicyCitation, Recommendation, ReasoningSection } from '@/types/report';
import type { WorkflowToolCall, WorkflowEvent } from '@/types/workflow';

export interface WorkflowResult {
  report: AssessmentReport;
  toolCalls: WorkflowToolCall[];
  summary: string;
}

/**
 * Executes the full claim assessment workflow deterministically.
 *
 * Sequence: verify documents → lookup policy → check medical necessity → calculate benefit (if approved)
 * All business rules are applied in TypeScript — no LLM involvement.
 * All data access goes through ClaimDataManager; no direct calls to lib/data or lib/tools.
 */
export function runAssessmentWorkflow(claim: ParsedClaim): WorkflowResult {
  const manager = new ClaimDataManager(claim);
  const today = new Date().toISOString().split('T')[0];

  // Steps 1–3: run all mandatory checks (memoized in manager)
  manager.verifyDocuments();
  manager.lookupPolicy();
  manager.getMedicalNecessity();

  const allDocsValid = manager.areAllDocsValid();
  const policyActive = manager.isPolicyActive();
  const claimTypeExcluded = manager.isClaimTypeExcluded();
  const necessityResult = manager.getMedicalNecessity();

  let recommendation: Recommendation;
  if (!allDocsValid) {
    recommendation = 'MORE_INFO_REQUIRED';
  } else if (!policyActive || claimTypeExcluded || !necessityResult.necessary) {
    recommendation = 'REJECTED';
  } else {
    recommendation = 'APPROVED';
  }

  // Step 4: benefit — only when prior checks pass
  let benefitResult: CalculateBenefitResult | null = null;
  if (recommendation === 'APPROVED') {
    benefitResult = manager.calculateBenefit();
    if (!benefitResult.success) recommendation = 'REJECTED';
  }

  // Derive report data from manager
  const docFindings = manager.getAllDocuments();
  const health = manager.getDocumentHealthSummary();
  const policy = manager.getPolicySnapshot();
  const matchedExclusion = manager.getMatchedExclusion();
  const matchedCoverage = manager.getMatchedCoverageClause();
  const invalidCount = health.invalid + health.missing;
  const b = benefitResult?.success ? benefitResult : null;

  // Policy citations
  const policyCitations: PolicyCitation[] = [];
  if (policy?.notes) {
    policyCitations.push({ clauseId: null, type: 'notes', section: 'Policy Notes', text: policy.notes });
  }
  if (claimTypeExcluded && matchedExclusion) {
    policyCitations.push({ clauseId: matchedExclusion.clauseId, type: 'exclusion', section: 'Exclusion', text: matchedExclusion.description });
  } else if (policyActive && matchedCoverage) {
    policyCitations.push({ clauseId: matchedCoverage.clauseId, type: matchedCoverage.type, section: 'Coverage', text: matchedCoverage.description });
  }

  // Audit decision mapping
  const decisionMapping: DecisionFactor[] = [
    {
      factor: 'DOCUMENT',
      status: allDocsValid ? 'PASS' : 'FAIL',
      clauseId: null,
      explanation: allDocsValid
        ? `All ${health.total} document(s) verified successfully.`
        : `Document(s) ${health.invalidIds.join(', ')} are missing or invalid.`,
    },
    {
      factor: 'POLICY',
      status: policyActive && !claimTypeExcluded && matchedCoverage ? 'PASS' : 'FAIL',
      clauseId: matchedExclusion?.clauseId ?? matchedCoverage?.clauseId ?? null,
      explanation: !policyActive
        ? `Policy ${claim.policyId} is not active.`
        : claimTypeExcluded && matchedExclusion
          ? `Claim type "${claim.claimType}" is excluded under clause ${matchedExclusion.clauseId}: ${matchedExclusion.description}`
          : matchedCoverage
            ? `Coverage confirmed under clause ${matchedCoverage.clauseId}.`
            : `No coverage found for claim type "${claim.claimType}".`,
    },
    {
      factor: 'MEDICAL',
      status: necessityResult.necessary ? 'PASS' : 'FAIL',
      clauseId: null,
      explanation: necessityResult.necessary
        ? `Medical necessity confirmed. ${necessityResult.rationale}`
        : `Medical necessity not established. ${necessityResult.rationale}`,
    },
    {
      factor: 'BENEFIT',
      status: b ? 'PASS' : 'FAIL',
      clauseId: matchedCoverage?.clauseId ?? null,
      explanation: b
        ? `Covered at ${b.coveragePercent}%. Covered amount: $${b.coveredAmount} (deductible $${b.deductibleApplied} applied).`
        : 'Not applicable — claim was not approved or benefit calculation failed.',
    },
  ];

  // Recommendation reasoning
  let reasoningText: string;
  if (recommendation === 'MORE_INFO_REQUIRED') {
    const ids = docFindings.filter((f) => f.status !== 'valid').map((f) => f.documentId).join(', ');
    reasoningText = `Document(s) ${ids} are missing or invalid. Valid documentation is required before assessment can proceed.`;
  } else if (recommendation === 'REJECTED') {
    if (!policyActive) {
      reasoningText = `Policy ${claim.policyId} is not active.`;
    } else if (claimTypeExcluded) {
      reasoningText = matchedExclusion
        ? `Claim type "${claim.claimType}" is excluded (${matchedExclusion.clauseId}): ${matchedExclusion.description}`
        : `Claim type "${claim.claimType}" is excluded under this policy.`;
    } else {
      reasoningText = `Medical necessity not established. ${necessityResult.rationale}`;
    }
  } else {
    reasoningText = b
      ? `All criteria satisfied. Benefit: $${b.coveredAmount} covered at ${b.coveragePercent}% (deductible $${b.deductibleApplied} applied).`
      : 'All criteria met.';
  }

  const reasoning: ReasoningSection = {
    summary: reasoningText,
    keyDrivers: decisionMapping.map((d) => {
      const clauseTag = d.clauseId ? ` [${d.clauseId}]` : '';
      return `${d.factor}${clauseTag}: ${d.status} — ${d.explanation}`;
    }),
  };

  const report: AssessmentReport = {
    claimId: claim.claimId,
    patientName: claim.patientName,
    assessmentDate: today,
    recommendation,
    sections: {
      documentReview: {
        summary: allDocsValid
          ? `All ${health.total} document(s) verified successfully.`
          : `${invalidCount} of ${health.total} document(s) failed verification.`,
        findings: docFindings,
      },
      policyVerification: {
        summary: policy
          ? `Policy ${policy.policyId} is ${policy.status}. Holder: ${policy.holderName}.`
          : `Policy ${claim.policyId} not found.`,
        policyId: claim.policyId,
        holderName: policy?.holderName ?? '',
        status: policy?.status ?? 'not found',
        coverageDetails: policy
          ? { coverages: policy.coverages, exclusions: policy.exclusions, annualDeductibleMet: policy.annualDeductibleMet }
          : {},
      },
      medicalNecessity: {
        summary: necessityResult.necessary
          ? `Medical necessity confirmed. ${necessityResult.rationale}`
          : `Medical necessity not established. ${necessityResult.rationale}`,
        necessary: necessityResult.necessary,
        rationale: necessityResult.rationale,
        codes: necessityResult.approvedProcedures,
      },
      benefitCalculation: b
        ? {
            summary: b.details,
            requestedAmount: claim.requestedAmount,
            coveredAmount: b.coveredAmount,
            patientResponsibility: b.patientResponsibility,
            deductibleApplied: b.deductibleApplied,
          }
        : {
            summary: recommendation === 'APPROVED' ? 'Benefit calculation failed.' : 'Not applicable — claim was not approved.',
            requestedAmount: claim.requestedAmount,
            coveredAmount: 0,
            patientResponsibility: claim.requestedAmount,
            deductibleApplied: 0,
          },
      recommendation: { decision: recommendation, reasoning: reasoningText },
      policyCitations,
      decisionMapping,
      reasoning,
    },
  };

  const summary = recommendation === 'APPROVED'
    ? `Claim ${claim.claimId} for ${claim.patientName}: APPROVED. Covered: $${b?.coveredAmount ?? 0} (deductible $${b?.deductibleApplied ?? 0} applied). Patient responsibility: $${b?.patientResponsibility ?? claim.requestedAmount}.`
    : recommendation === 'REJECTED'
      ? `Claim ${claim.claimId} for ${claim.patientName}: REJECTED. ${reasoningText}`
      : `Claim ${claim.claimId} for ${claim.patientName}: MORE INFORMATION REQUIRED. ${reasoningText}`;

  return { report, toolCalls: [...manager.toolCalls], summary };
}

/**
 * Streaming variant of the assessment workflow.
 * Yields WorkflowEvent objects as each step completes so the API route can
 * forward them to the client via SSE. Business logic is identical to
 * runAssessmentWorkflow — only the delivery mechanism differs.
 *
 * All tool calls go through ClaimDataManager. The workflow controls SSE event
 * emission; the manager controls data access and memoization.
 */
export async function* streamAssessmentWorkflow(claim: ParsedClaim): AsyncGenerator<WorkflowEvent> {
  const manager = new ClaimDataManager(claim);
  const today = new Date().toISOString().split('T')[0];

  yield { type: 'workflow-start', claimId: claim.claimId };

  // ── Step 1: Document Verification ─────────────────────────────────────────
  yield { type: 'step-start', step: 1, stepName: 'Document Verification' };

  for (const documentId of claim.documentIds) {
    yield { type: 'tool-start', toolCallId: manager.peekNextCallId(), toolName: 'verifyDocument', input: { documentId }, step: 1 };

    const result = manager.verifyDocument(documentId);
    const tc = manager.getLastToolCall();

    let line: string;
    if (result.success && result.valid) {
      const docType = result.documentType.replace(/_/g, ' ');
      const prov = result.provider ? ` · ${result.provider}` : '';
      line = `✓ ${documentId} · ${docType}${prov} — valid`;
    } else if (result.success) {
      const docType = result.documentType.replace(/_/g, ' ');
      const issueText = result.issues.length > 0
        ? `\n   ↳ ${result.issues[0]}`
        : '';
      line = `✗ ${documentId} · ${docType} — not valid${issueText}`;
    } else {
      line = `✗ ${documentId} — ${result.error}`;
    }

    yield { type: 'tool-complete', toolCall: { ...tc, status: 'completed' }, line, step: 1 };
    yield { type: 'step-result', toolCall: tc, line };
  }

  const allDocsValid = manager.areAllDocsValid();
  const health = manager.getDocumentHealthSummary();
  const docFindings = manager.getAllDocuments();

  yield {
    type: 'step-complete',
    step: 1,
    stepName: 'Document Verification',
    summary: allDocsValid
      ? `All ${health.total} document(s) verified`
      : `${health.invalid + health.missing} of ${health.total} document(s) failed`,
  };

  yield {
    type: 'report-update',
    step: 1,
    stepName: 'Document Verification',
    partial: {
      claimId: claim.claimId,
      patientName: claim.patientName,
      assessmentDate: today,
      sections: {
        documentReview: {
          summary: allDocsValid
            ? `All ${health.total} document(s) verified successfully.`
            : `${health.invalid + health.missing} of ${health.total} document(s) failed verification.`,
          findings: docFindings,
        },
      },
    },
  };

  // ── Step 2: Policy Verification ────────────────────────────────────────────
  yield { type: 'step-start', step: 2, stepName: 'Policy Verification' };
  yield { type: 'tool-start', toolCallId: manager.peekNextCallId(), toolName: 'lookupPolicy', input: { policyId: claim.policyId }, step: 2 };

  manager.lookupPolicy();
  const policyTc = manager.getLastToolCall();
  const policy = manager.getPolicySnapshot();
  const policyActive = manager.isPolicyActive();
  const claimTypeExcluded = manager.isClaimTypeExcluded();
  const matchedExcl = manager.getMatchedExclusion();
  const matchedCov = manager.getMatchedCoverageClause();

  let policyLine: string;
  if (!policy) {
    policyLine = `✗ Policy ${claim.policyId} not found in system`;
  } else if (!policyActive) {
    policyLine = `✗ Policy ${claim.policyId} (${policy.holderName}) is ${policy.status}`;
  } else {
    const deductibleNote = policy.annualDeductibleMet
      ? 'annual deductible met'
      : 'annual deductible not yet met';
    policyLine = `✓ Policy ${claim.policyId} active — ${policy.holderName} (expires ${policy.expirationDate})\n  ${deductibleNote}`;
    if (claimTypeExcluded && matchedExcl) {
      policyLine += `\n✗ Claim type "${claim.claimType}" excluded under ${matchedExcl.clauseId}\n  "${matchedExcl.description}"`;
    } else {
      const cov = manager.getCoverage(claim.claimType);
      if (cov) {
        const preAuth = cov.requiresPreAuth ? ' · pre-authorization required' : '';
        policyLine += `\n✓ ${claim.claimType} coverage: ${cov.coveragePercent}% up to $${cov.maxBenefit.toLocaleString()} (deductible $${cov.deductible.toLocaleString()})${preAuth}`;
        if (matchedCov) {
          policyLine += `\n  ${matchedCov.clauseId}: "${matchedCov.description}"`;
        }
      } else {
        policyLine += `\n✗ No coverage for claim type "${claim.claimType}" under this policy`;
      }
    }
  }

  yield { type: 'tool-complete', toolCall: { ...policyTc, status: 'completed' }, line: policyLine, step: 2 };
  yield { type: 'step-result', toolCall: policyTc, line: policyLine };

  const policyCitations: PolicyCitation[] = [];
  if (policy?.notes) {
    policyCitations.push({ clauseId: null, type: 'notes', section: 'Policy Notes', text: policy.notes });
  }
  if (claimTypeExcluded && matchedExcl) {
    policyCitations.push({ clauseId: matchedExcl.clauseId, type: 'exclusion', section: 'Exclusion', text: matchedExcl.description });
  } else if (policyActive && matchedCov) {
    policyCitations.push({ clauseId: matchedCov.clauseId, type: matchedCov.type, section: 'Coverage', text: matchedCov.description });
  }

  yield { type: 'step-complete', step: 2, stepName: 'Policy Verification', summary: policyActive ? 'Policy active' : 'Policy inactive' };

  yield {
    type: 'report-update',
    step: 2,
    stepName: 'Policy Verification',
    partial: {
      claimId: claim.claimId,
      sections: {
        policyVerification: {
          summary: policy
            ? `Policy ${policy.policyId} is ${policy.status}. Holder: ${policy.holderName}.`
            : `Policy ${claim.policyId} not found.`,
          policyId: claim.policyId,
          holderName: policy?.holderName ?? '',
          status: policy?.status ?? 'not found',
          coverageDetails: policy
            ? { coverages: policy.coverages, exclusions: policy.exclusions, annualDeductibleMet: policy.annualDeductibleMet }
            : {},
        },
        policyCitations,
      },
    },
  };

  // ── Step 3: Medical Necessity ──────────────────────────────────────────────
  yield { type: 'step-start', step: 3, stepName: 'Medical Necessity' };
  yield {
    type: 'tool-start',
    toolCallId: manager.peekNextCallId(),
    toolName: 'checkMedicalNecessity',
    input: { diagnosis: claim.diagnosis, procedures: claim.procedures },
    step: 3,
  };

  manager.getMedicalNecessity();
  const necessityTc = manager.getLastToolCall();
  const necessityResult = manager.getMedicalNecessity(); // instant — already cached

  let necessityLine: string;
  if (necessityResult.necessary) {
    const cptList = necessityResult.approvedProcedures.length > 0
      ? `\n  Approved CPT codes: ${necessityResult.approvedProcedures.join(', ')}`
      : '';
    const reqList = necessityResult.requestedProcedures.length > 0
      ? `\n  Requested procedure(s): ${necessityResult.requestedProcedures.join(', ')}`
      : '';
    necessityLine = `Diagnosis: ${claim.diagnosis}\n✓ Medical necessity established\n  ${necessityResult.rationale}${cptList}${reqList}`;
  } else {
    necessityLine = `Diagnosis: ${claim.diagnosis}\n✗ Medical necessity not established\n  ${necessityResult.rationale}`;
  }

  yield { type: 'tool-complete', toolCall: { ...necessityTc, status: 'completed' }, line: necessityLine, step: 3 };
  yield { type: 'step-result', toolCall: necessityTc, line: necessityLine };

  yield { type: 'step-complete', step: 3, stepName: 'Medical Necessity', summary: necessityResult.necessary ? 'Medically necessary' : 'Not medically necessary' };

  yield {
    type: 'report-update',
    step: 3,
    stepName: 'Medical Necessity',
    partial: {
      claimId: claim.claimId,
      sections: {
        medicalNecessity: {
          summary: necessityResult.necessary
            ? `Medical necessity confirmed. ${necessityResult.rationale}`
            : `Medical necessity not established. ${necessityResult.rationale}`,
          necessary: necessityResult.necessary,
          rationale: necessityResult.rationale,
          codes: necessityResult.approvedProcedures,
        },
      },
    },
  };

  // ── Decision ───────────────────────────────────────────────────────────────
  let recommendation: Recommendation;
  if (!allDocsValid) {
    recommendation = 'MORE_INFO_REQUIRED';
  } else if (!policyActive || claimTypeExcluded || !necessityResult.necessary) {
    recommendation = 'REJECTED';
  } else {
    recommendation = 'APPROVED';
  }

  if (recommendation !== 'APPROVED') {
    yield {
      type: 'report-update',
      step: 3,
      stepName: 'Benefit Calculation',
      partial: {
        claimId: claim.claimId,
        sections: {
          benefitCalculation: {
            summary: 'Not applicable — claim was not approved.',
            requestedAmount: claim.requestedAmount,
            coveredAmount: 0,
            patientResponsibility: claim.requestedAmount,
            deductibleApplied: 0,
          },
        },
      },
    };
  }

  // ── Step 4: Benefit Calculation (APPROVED only) ────────────────────────────
  let benefitResult: CalculateBenefitResult | null = null;

  if (recommendation === 'APPROVED') {
    yield { type: 'step-start', step: 4, stepName: 'Benefit Calculation' };
    yield {
      type: 'tool-start',
      toolCallId: manager.peekNextCallId(),
      toolName: 'calculateBenefit',
      input: { policyId: claim.policyId, claimType: claim.claimType, amount: claim.requestedAmount },
      step: 4,
    };

    benefitResult = manager.calculateBenefit();
    const benefitTc = manager.getLastToolCall();

    let benefitLine: string;
    if (benefitResult.success) {
      const clauseRef = matchedCov ? ` · ${matchedCov.clauseId}` : '';
      benefitLine = [
        `✓ Benefit calculated${clauseRef}`,
        `  Requested:            $${claim.requestedAmount.toLocaleString()}`,
        `  Coverage:             ${benefitResult.coveragePercent}%`,
        `  Deductible applied:   $${benefitResult.deductibleApplied.toLocaleString()}`,
        `  → Covered amount:     $${benefitResult.coveredAmount.toLocaleString()}`,
        `  → Patient responsibility: $${benefitResult.patientResponsibility.toLocaleString()}`,
      ].join('\n');
    } else {
      benefitLine = `✗ Benefit calculation failed: ${benefitResult.error}`;
    }

    yield { type: 'tool-complete', toolCall: { ...benefitTc, status: 'completed' }, line: benefitLine, step: 4 };
    yield { type: 'step-result', toolCall: benefitTc, line: benefitLine };

    yield {
      type: 'step-complete',
      step: 4,
      stepName: 'Benefit Calculation',
      summary: benefitResult.success ? `Covered: $${benefitResult.coveredAmount}` : 'Failed',
    };

    yield {
      type: 'report-update',
      step: 4,
      stepName: 'Benefit Calculation',
      partial: {
        claimId: claim.claimId,
        sections: {
          benefitCalculation: benefitResult.success === true
            ? {
                summary: benefitResult.details,
                requestedAmount: claim.requestedAmount,
                coveredAmount: benefitResult.coveredAmount,
                patientResponsibility: benefitResult.patientResponsibility,
                deductibleApplied: benefitResult.deductibleApplied,
              }
            : {
                summary: 'Benefit calculation failed.',
                requestedAmount: claim.requestedAmount,
                coveredAmount: 0,
                patientResponsibility: claim.requestedAmount,
                deductibleApplied: 0,
              },
        },
      },
    };

    if (!benefitResult.success) recommendation = 'REJECTED';
  }

  // ── Build reasoning ────────────────────────────────────────────────────────
  const bFinal = benefitResult?.success ? benefitResult : null;

  // Short one-liner for the report panel's reasoning.summary
  let reasoningText: string;
  if (recommendation === 'MORE_INFO_REQUIRED') {
    const ids = docFindings.filter((f) => f.status !== 'valid').map((f) => f.documentId).join(', ');
    reasoningText = `Document(s) ${ids} are missing or invalid. Valid documentation is required before assessment can proceed.`;
  } else if (recommendation === 'REJECTED') {
    if (!policyActive) {
      reasoningText = `Policy ${claim.policyId} is not active.`;
    } else if (claimTypeExcluded) {
      reasoningText = matchedExcl
        ? `Claim type "${claim.claimType}" is excluded under ${matchedExcl.clauseId}: ${matchedExcl.description}`
        : `Claim type "${claim.claimType}" is excluded under this policy.`;
    } else {
      reasoningText = `Medical necessity not established. ${necessityResult.rationale}`;
    }
  } else {
    reasoningText = bFinal
      ? `All criteria satisfied. Covered: $${bFinal.coveredAmount.toLocaleString()} at ${bFinal.coveragePercent}% (deductible $${bFinal.deductibleApplied.toLocaleString()} applied).`
      : 'All criteria met.';
  }

  // ── Audit decision mapping ─────────────────────────────────────────────────
  const docSummaryList = docFindings
    .map((f) => `${f.documentId} (${f.documentType.replace(/_/g, ' ')})`)
    .join(', ');
  const invalidDocDetail = docFindings
    .filter((f) => f.status !== 'valid')
    .map((f) => {
      const issue = f.issues?.[0] ? ` — ${f.issues[0]}` : '';
      return `${f.documentId} (${f.documentType.replace(/_/g, ' ')})${issue}`;
    })
    .join('; ');

  const decisionMapping: DecisionFactor[] = [
    {
      factor: 'DOCUMENT',
      status: allDocsValid ? 'PASS' : 'FAIL',
      clauseId: null,
      explanation: allDocsValid
        ? `All ${health.total} document(s) verified: ${docSummaryList}.`
        : `${health.invalid + health.missing} of ${health.total} document(s) failed verification. ${invalidDocDetail}.`,
    },
    {
      factor: 'POLICY',
      status: policyActive && !claimTypeExcluded && matchedCov ? 'PASS' : 'FAIL',
      clauseId: matchedExcl?.clauseId ?? matchedCov?.clauseId ?? null,
      explanation: !policyActive
        ? `Policy ${claim.policyId} (${policy?.holderName ?? 'unknown'}) is not active.`
        : claimTypeExcluded && matchedExcl
          ? `Claim type "${claim.claimType}" is excluded under clause ${matchedExcl.clauseId}: ${matchedExcl.description}`
          : matchedCov
            ? `Coverage confirmed under ${matchedCov.clauseId}: "${matchedCov.description}"`
            : `No coverage found for claim type "${claim.claimType}".`,
    },
    {
      factor: 'MEDICAL',
      status: necessityResult.necessary ? 'PASS' : 'FAIL',
      clauseId: null,
      explanation: necessityResult.necessary
        ? `Medical necessity confirmed for diagnosis "${claim.diagnosis}". ${necessityResult.rationale}${necessityResult.approvedProcedures.length > 0 ? ` Approved CPT codes: ${necessityResult.approvedProcedures.join(', ')}.` : ''}`
        : `Medical necessity not established for diagnosis "${claim.diagnosis}". ${necessityResult.rationale}`,
    },
    {
      factor: 'BENEFIT',
      status: bFinal ? 'PASS' : 'FAIL',
      clauseId: matchedCov?.clauseId ?? null,
      explanation: bFinal
        ? `Covered at ${bFinal.coveragePercent}% under ${matchedCov?.clauseId ?? 'policy'}. Covered: $${bFinal.coveredAmount.toLocaleString()} (deductible $${bFinal.deductibleApplied.toLocaleString()} applied; patient responsibility: $${bFinal.patientResponsibility.toLocaleString()}).`
        : 'Not applicable — claim was not approved.',
    },
  ];

  const reasoning: ReasoningSection = {
    summary: reasoningText,
    keyDrivers: decisionMapping.map((d) => {
      const clauseTag = d.clauseId ? ` [${d.clauseId}]` : '';
      return `${d.factor}${clauseTag}: ${d.status} — ${d.explanation}`;
    }),
  };

  // Rich multi-line narration for the chat window
  const introText =
    recommendation === 'APPROVED'
      ? 'All claim assessment criteria have been satisfied.'
      : recommendation === 'REJECTED'
        ? !policyActive
          ? 'Claim denied. Policy is not active.'
          : claimTypeExcluded
            ? 'Claim denied. A policy exclusion applies to this claim type.'
            : 'Claim denied. Medical necessity has not been established.'
        : 'Assessment on hold. Required documentation is missing or invalid.';

  const n1doc = allDocsValid
    ? `All ${health.total} document(s) verified (${docSummaryList})`
    : `${health.invalid + health.missing} of ${health.total} document(s) not valid — ${health.invalidIds.join(', ')}`;
  const n2policy = !policyActive
    ? `Policy ${claim.policyId} is not active`
    : claimTypeExcluded && matchedExcl
      ? `Excluded under ${matchedExcl.clauseId}: "${matchedExcl.description}"`
      : matchedCov
        ? `Coverage confirmed — ${matchedCov.clauseId}: "${matchedCov.description}"`
        : `No coverage for claim type "${claim.claimType}"`;
  const n3med = necessityResult.necessary
    ? `Medical necessity confirmed for "${claim.diagnosis}" — ${necessityResult.rationale}`
    : `Not established for "${claim.diagnosis}" — ${necessityResult.rationale}`;
  const n4ben = bFinal
    ? `Covered $${bFinal.coveredAmount.toLocaleString()} at ${bFinal.coveragePercent}% (deductible $${bFinal.deductibleApplied.toLocaleString()} applied; patient responsibility $${bFinal.patientResponsibility.toLocaleString()})`
    : 'Not applicable';

  const docStatus = allDocsValid ? 'PASS' : 'FAIL';
  const polStatus = policyActive && !claimTypeExcluded && matchedCov ? 'PASS' : 'FAIL';
  const medStatus = necessityResult.necessary ? 'PASS' : 'FAIL';
  const benStatus = bFinal ? 'PASS' : 'N/A ';

  const activeCitation = matchedExcl
    ? `\nPolicy Citation: ${matchedExcl.clauseId} — "${matchedExcl.description}"`
    : matchedCov
      ? `\nPolicy Citation: ${matchedCov.clauseId} — "${matchedCov.description}"`
      : '';

  const chatNarration = [
    introText,
    '',
    `1. Documents  [${docStatus}] — ${n1doc}`,
    `2. Policy     [${polStatus}] — ${n2policy}`,
    `3. Medical    [${medStatus}] — ${n3med}`,
    `4. Benefit    [${benStatus}] — ${n4ben}`,
    activeCitation,
  ].join('\n');

  yield { type: 'workflow-complete', recommendation, reasoning: chatNarration };

  yield {
    type: 'report-update',
    step: 0,
    stepName: 'Final Assessment',
    partial: {
      claimId: claim.claimId,
      recommendation,
      sections: {
        recommendation: { decision: recommendation, reasoning: reasoningText },
        decisionMapping,
        reasoning,
      },
    },
  };

  // ── Final report ───────────────────────────────────────────────────────────
  const report: AssessmentReport = {
    claimId: claim.claimId,
    patientName: claim.patientName,
    assessmentDate: today,
    recommendation,
    sections: {
      documentReview: {
        summary: allDocsValid
          ? `All ${health.total} document(s) verified successfully.`
          : `${health.invalid + health.missing} of ${health.total} document(s) failed verification.`,
        findings: docFindings,
      },
      policyVerification: {
        summary: policy
          ? `Policy ${policy.policyId} is ${policy.status}. Holder: ${policy.holderName}.`
          : `Policy ${claim.policyId} not found.`,
        policyId: claim.policyId,
        holderName: policy?.holderName ?? '',
        status: policy?.status ?? 'not found',
        coverageDetails: policy
          ? { coverages: policy.coverages, exclusions: policy.exclusions, annualDeductibleMet: policy.annualDeductibleMet }
          : {},
      },
      medicalNecessity: {
        summary: necessityResult.necessary
          ? `Medical necessity confirmed. ${necessityResult.rationale}`
          : `Medical necessity not established. ${necessityResult.rationale}`,
        necessary: necessityResult.necessary,
        rationale: necessityResult.rationale,
        codes: necessityResult.approvedProcedures,
      },
      benefitCalculation: bFinal
        ? {
            summary: bFinal.details,
            requestedAmount: claim.requestedAmount,
            coveredAmount: bFinal.coveredAmount,
            patientResponsibility: bFinal.patientResponsibility,
            deductibleApplied: bFinal.deductibleApplied,
          }
        : {
            summary: recommendation === 'APPROVED' ? 'Benefit calculation failed.' : 'Not applicable — claim was not approved.',
            requestedAmount: claim.requestedAmount,
            coveredAmount: 0,
            patientResponsibility: claim.requestedAmount,
            deductibleApplied: 0,
          },
      recommendation: { decision: recommendation, reasoning: reasoningText },
      policyCitations,
      decisionMapping,
      reasoning,
    },
  };

  const bSummary = benefitResult?.success ? benefitResult : null;
  const summary = recommendation === 'APPROVED'
    ? `Claim ${claim.claimId} for ${claim.patientName}: APPROVED. Covered: $${bSummary?.coveredAmount ?? 0} (deductible $${bSummary?.deductibleApplied ?? 0} applied). Patient responsibility: $${bSummary?.patientResponsibility ?? claim.requestedAmount}.`
    : recommendation === 'REJECTED'
      ? `Claim ${claim.claimId} for ${claim.patientName}: REJECTED. ${reasoningText}`
      : `Claim ${claim.claimId} for ${claim.patientName}: MORE INFORMATION REQUIRED. ${reasoningText}`;

  yield { type: 'final-report', report, toolCalls: [...manager.toolCalls], summary };
}
