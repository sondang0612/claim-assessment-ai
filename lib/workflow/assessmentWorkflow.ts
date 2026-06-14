import { verifyDocument } from '@/lib/tools/verifyDocument';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';
import type { ParsedClaim } from '@/lib/parser/claimParser';
import type { AssessmentReport, DecisionFactor, DocumentFinding, PolicyCitation, Recommendation, ReasoningSection } from '@/types/report';
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
 * All business rules (approval/rejection/more-info) are applied in TypeScript — no LLM involvement.
 */
export function runAssessmentWorkflow(claim: ParsedClaim): WorkflowResult {
  const toolCalls: WorkflowToolCall[] = [];
  let callIndex = 0;

  function record<T>(toolName: string, input: Record<string, unknown>, output: T): T {
    toolCalls.push({ toolCallId: `tool-${++callIndex}`, toolName, input, output, status: 'done' });
    return output;
  }

  const today = new Date().toISOString().split('T')[0];

  // Step 1: Verify all documents
  const docResults = claim.documentIds.map((documentId) => ({
    documentId,
    result: record('verifyDocument', { documentId }, verifyDocument({ documentId })),
  }));

  // Step 2: Look up policy
  const policyResult = record(
    'lookupPolicy',
    { policyId: claim.policyId },
    lookupPolicy({ policyId: claim.policyId }),
  );

  // Step 3: Check medical necessity (always run — needed for the report regardless of outcome)
  const necessityResult = record(
    'checkMedicalNecessity',
    { diagnosis: claim.diagnosis, procedures: claim.procedures },
    checkMedicalNecessity({ diagnosis: claim.diagnosis, procedures: claim.procedures }),
  );

  // Evaluate conditions
  const invalidDocs = docResults.filter(({ result }) => !result.success || !result.valid);
  const allDocsValid = invalidDocs.length === 0;

  const policy = policyResult.success ? policyResult.policy : null;
  const policyActive = policy !== null && policy.status === 'active';
  const claimTypeExcluded =
    policyActive && (policy?.exclusions.some((e) => e.claimTypes.includes(claim.claimType)) ?? false);

  // Apply decision rules
  let recommendation: Recommendation;
  if (!allDocsValid) {
    recommendation = 'MORE_INFO_REQUIRED';
  } else if (!policyActive || claimTypeExcluded || !necessityResult.necessary) {
    recommendation = 'REJECTED';
  } else {
    recommendation = 'APPROVED';
  }

  // Step 4: Calculate benefit — only when all prior conditions pass
  const benefitResult =
    recommendation === 'APPROVED'
      ? record(
          'calculateBenefit',
          { policyId: claim.policyId, claimType: claim.claimType, amount: claim.requestedAmount },
          calculateBenefit({
            policyId: claim.policyId,
            claimType: claim.claimType,
            amount: claim.requestedAmount,
          }),
        )
      : null;

  // Downgrade to REJECTED if benefit calculation fails despite passing earlier checks
  if (benefitResult !== null && !benefitResult.success) {
    recommendation = 'REJECTED';
  }

  // Build document findings
  const docFindings: DocumentFinding[] = docResults.map(({ documentId, result }) => ({
    documentId,
    documentType: result.success ? result.documentType : 'unknown',
    status: !result.success ? 'not found' : result.valid ? 'valid' : 'invalid',
    issues: result.success ? result.issues : [result.error],
  }));

  // Build policy citations from structured policy data
  const policyCitations: PolicyCitation[] = [];
  if (policy?.notes) {
    policyCitations.push({ clauseId: null, type: 'notes', section: 'Policy Notes', text: policy.notes });
  }
  if (claimTypeExcluded && policy) {
    const excl = policy.exclusions.find((e) => e.claimTypes.includes(claim.claimType));
    if (excl) policyCitations.push({ clauseId: excl.clauseId, type: 'exclusion', section: 'Exclusion', text: excl.description });
  } else if (policyActive && policy) {
    const coverageClause = policy.coverageClauses.find((c) => c.claimType === claim.claimType);
    if (coverageClause) {
      policyCitations.push({ clauseId: coverageClause.clauseId, type: coverageClause.type, section: 'Coverage', text: coverageClause.description });
    }
  }

  // Build audit decision mapping — one entry per evaluation factor
  const decisionMapping: DecisionFactor[] = [];

  const docStatus: DecisionFactor['status'] = allDocsValid ? 'PASS' : 'FAIL';
  decisionMapping.push({
    factor: 'DOCUMENT',
    status: docStatus,
    clauseId: null,
    explanation: allDocsValid
      ? `All ${docResults.length} document(s) verified successfully.`
      : `Document(s) ${invalidDocs.map(({ documentId }) => documentId).join(', ')} are missing or invalid.`,
  });

  const matchedExclusion = policyActive && policy ? policy.exclusions.find((e) => e.claimTypes.includes(claim.claimType)) : undefined;
  const matchedCoverage = policyActive && policy ? policy.coverageClauses.find((c) => c.claimType === claim.claimType) : undefined;
  decisionMapping.push({
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
  });

  decisionMapping.push({
    factor: 'MEDICAL',
    status: necessityResult.necessary ? 'PASS' : 'FAIL',
    clauseId: null,
    explanation: necessityResult.necessary
      ? `Medical necessity confirmed. ${necessityResult.rationale}`
      : `Medical necessity not established. ${necessityResult.rationale}`,
  });

  const b = benefitResult?.success ? benefitResult : null;
  decisionMapping.push({
    factor: 'BENEFIT',
    status: b ? 'PASS' : 'FAIL',
    clauseId: matchedCoverage?.clauseId ?? null,
    explanation: b
      ? `Covered at ${b.coveragePercent}%. Covered amount: $${b.coveredAmount} (deductible $${b.deductibleApplied} applied).`
      : 'Not applicable — claim was not approved or benefit calculation failed.',
  });

  // Build recommendation reasoning string
  let reasoningText: string;
  if (recommendation === 'MORE_INFO_REQUIRED') {
    const ids = docFindings
      .filter((f) => f.status !== 'valid')
      .map((f) => f.documentId)
      .join(', ');
    reasoningText = `Document(s) ${ids} are missing or invalid. Valid documentation is required before assessment can proceed.`;
  } else if (recommendation === 'REJECTED') {
    if (!policyActive) {
      reasoningText = `Policy ${claim.policyId} is not active.`;
    } else if (claimTypeExcluded) {
      const excl = policy?.exclusions.find((e) => e.claimTypes.includes(claim.claimType));
      reasoningText = excl
        ? `Claim type "${claim.claimType}" is excluded (${excl.clauseId}): ${excl.description}`
        : `Claim type "${claim.claimType}" is excluded under this policy.`;
    } else {
      reasoningText = `Medical necessity not established. ${necessityResult.rationale}`;
    }
  } else {
    reasoningText = b
      ? `All criteria satisfied. Benefit: $${b.coveredAmount} covered at ${b.coveragePercent}% (deductible $${b.deductibleApplied} applied).`
      : 'All criteria met.';
  }

  // Build structured reasoning section
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
          ? `All ${docResults.length} document(s) verified successfully.`
          : `${invalidDocs.length} of ${docResults.length} document(s) failed verification.`,
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
          ? {
              coverages: policy.coverages,
              exclusions: policy.exclusions,
              annualDeductibleMet: policy.annualDeductibleMet,
            }
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
      benefitCalculation:
        benefitResult?.success === true
          ? {
              summary: benefitResult.details,
              requestedAmount: claim.requestedAmount,
              coveredAmount: benefitResult.coveredAmount,
              patientResponsibility: benefitResult.patientResponsibility,
              deductibleApplied: benefitResult.deductibleApplied,
            }
          : {
              summary:
                recommendation === 'APPROVED'
                  ? 'Benefit calculation failed.'
                  : 'Not applicable — claim was not approved.',
              requestedAmount: claim.requestedAmount,
              coveredAmount: 0,
              patientResponsibility: claim.requestedAmount,
              deductibleApplied: 0,
            },
      recommendation: {
        decision: recommendation,
        reasoning: reasoningText,
      },
      policyCitations,
      decisionMapping,
      reasoning,
    },
  };

  const bCalc = benefitResult?.success ? benefitResult : null;
  const summary =
    recommendation === 'APPROVED'
      ? `Claim ${claim.claimId} for ${claim.patientName}: APPROVED. Covered: $${bCalc?.coveredAmount ?? 0} (deductible $${bCalc?.deductibleApplied ?? 0} applied). Patient responsibility: $${bCalc?.patientResponsibility ?? claim.requestedAmount}.`
      : recommendation === 'REJECTED'
        ? `Claim ${claim.claimId} for ${claim.patientName}: REJECTED. ${reasoningText}`
        : `Claim ${claim.claimId} for ${claim.patientName}: MORE INFORMATION REQUIRED. ${reasoningText}`;

  return { report, toolCalls, summary };
}

/**
 * Streaming variant of the assessment workflow.
 * Yields WorkflowEvent objects as each step completes so the API route can
 * forward them to the client via SSE.  Business logic is identical to
 * runAssessmentWorkflow — only the delivery mechanism differs.
 */
export async function* streamAssessmentWorkflow(claim: ParsedClaim): AsyncGenerator<WorkflowEvent> {
  const toolCalls: WorkflowToolCall[] = [];
  let callIndex = 0;

  function record<T>(toolName: string, input: Record<string, unknown>, output: T): T {
    toolCalls.push({ toolCallId: `tool-${++callIndex}`, toolName, input, output, status: 'done' });
    return output;
  }

  const today = new Date().toISOString().split('T')[0];

  yield { type: 'workflow-start', claimId: claim.claimId };

  // ── Step 1: Document Verification ────────────────────────────────────────────
  yield { type: 'step-start', step: 1, stepName: 'Document Verification' };

  const docResults: { documentId: string; result: ReturnType<typeof verifyDocument> }[] = [];

  for (const documentId of claim.documentIds) {
    const nextId = `tool-${callIndex + 1}`;
    yield { type: 'tool-start', toolCallId: nextId, toolName: 'verifyDocument', input: { documentId }, step: 1 };

    const result = record('verifyDocument', { documentId }, verifyDocument({ documentId }));
    const tc = toolCalls[toolCalls.length - 1];

    let line: string;
    if (result.success && result.valid) {
      line = `✓ ${documentId} verified`;
    } else if (result.success) {
      line = `✗ ${documentId} invalid${result.issues.length > 0 ? ` (${result.issues.join(', ')})` : ''}`;
    } else {
      line = `✗ ${documentId} not found`;
    }

    yield { type: 'tool-complete', toolCall: { ...tc, status: 'completed' }, line, step: 1 };
    yield { type: 'step-result', toolCall: tc, line };
    docResults.push({ documentId, result });
  }

  const invalidDocs = docResults.filter(({ result }) => !result.success || !result.valid);
  const allDocsValid = invalidDocs.length === 0;

  // Build docFindings here so step 1 report-update can include them.
  const docFindings: DocumentFinding[] = docResults.map(({ documentId, result }) => ({
    documentId,
    documentType: result.success ? result.documentType : 'unknown',
    status: !result.success ? 'not found' : result.valid ? 'valid' : 'invalid',
    issues: result.success ? result.issues : [result.error],
  }));

  yield {
    type: 'step-complete',
    step: 1,
    stepName: 'Document Verification',
    summary: allDocsValid
      ? `All ${docResults.length} document(s) verified`
      : `${invalidDocs.length} of ${docResults.length} document(s) failed`,
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
            ? `All ${docResults.length} document(s) verified successfully.`
            : `${invalidDocs.length} of ${docResults.length} document(s) failed verification.`,
          findings: docFindings,
        },
      },
    },
  };

  // ── Step 2: Policy Verification ───────────────────────────────────────────────
  yield { type: 'step-start', step: 2, stepName: 'Policy Verification' };

  const policyNextId = `tool-${callIndex + 1}`;
  yield { type: 'tool-start', toolCallId: policyNextId, toolName: 'lookupPolicy', input: { policyId: claim.policyId }, step: 2 };

  const policyResult = record(
    'lookupPolicy',
    { policyId: claim.policyId },
    lookupPolicy({ policyId: claim.policyId }),
  );
  const policyTc = toolCalls[toolCalls.length - 1];

  const policy = policyResult.success ? policyResult.policy : null;
  const policyActive = policy !== null && policy.status === 'active';
  const claimTypeExcluded =
    policyActive && (policy?.exclusions.some((e) => e.claimTypes.includes(claim.claimType)) ?? false);

  let policyLine: string;
  if (!policyResult.success) {
    policyLine = `✗ Policy ${claim.policyId} not found`;
  } else if (!policyActive) {
    policyLine = `✗ Policy ${claim.policyId} is ${policy?.status ?? 'inactive'}`;
  } else {
    const hasCoverage = policy!.coverages.some((c) => c.claimType === claim.claimType);
    policyLine = `✓ Policy active`;
    if (claimTypeExcluded) {
      policyLine += `\n✗ ${claim.claimType} is excluded`;
    } else if (hasCoverage) {
      policyLine += `\n✓ ${claim.claimType} coverage found`;
    } else {
      policyLine += `\n✗ No ${claim.claimType} coverage`;
    }
  }

  yield { type: 'tool-complete', toolCall: { ...policyTc, status: 'completed' }, line: policyLine, step: 2 };
  yield { type: 'step-result', toolCall: policyTc, line: policyLine };

  // Build policyCitations here — all data is available immediately after step 2.
  const policyCitations: PolicyCitation[] = [];
  if (policy?.notes) {
    policyCitations.push({ clauseId: null, type: 'notes', section: 'Policy Notes', text: policy.notes });
  }
  if (claimTypeExcluded && policy) {
    const excl = policy.exclusions.find((e) => e.claimTypes.includes(claim.claimType));
    if (excl) policyCitations.push({ clauseId: excl.clauseId, type: 'exclusion', section: 'Exclusion', text: excl.description });
  } else if (policyActive && policy) {
    const coverageClause = policy.coverageClauses.find((c) => c.claimType === claim.claimType);
    if (coverageClause) {
      policyCitations.push({ clauseId: coverageClause.clauseId, type: coverageClause.type, section: 'Coverage', text: coverageClause.description });
    }
  }

  yield {
    type: 'step-complete',
    step: 2,
    stepName: 'Policy Verification',
    summary: policyActive ? 'Policy active' : 'Policy inactive',
  };

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
            ? {
                coverages: policy.coverages,
                exclusions: policy.exclusions,
                annualDeductibleMet: policy.annualDeductibleMet,
              }
            : {},
        },
        policyCitations,
      },
    },
  };

  // ── Step 3: Medical Necessity ────────────────────────────────────────────────
  yield { type: 'step-start', step: 3, stepName: 'Medical Necessity' };

  const necessityNextId = `tool-${callIndex + 1}`;
  yield {
    type: 'tool-start',
    toolCallId: necessityNextId,
    toolName: 'checkMedicalNecessity',
    input: { diagnosis: claim.diagnosis, procedures: claim.procedures },
    step: 3,
  };

  const necessityResult = record(
    'checkMedicalNecessity',
    { diagnosis: claim.diagnosis, procedures: claim.procedures },
    checkMedicalNecessity({ diagnosis: claim.diagnosis, procedures: claim.procedures }),
  );
  const necessityTc = toolCalls[toolCalls.length - 1];

  const necessityLine = necessityResult.necessary
    ? `✓ Procedure medically necessary`
    : `✗ Medical necessity not established`;

  yield { type: 'tool-complete', toolCall: { ...necessityTc, status: 'completed' }, line: necessityLine, step: 3 };
  yield { type: 'step-result', toolCall: necessityTc, line: necessityLine };

  yield {
    type: 'step-complete',
    step: 3,
    stepName: 'Medical Necessity',
    summary: necessityResult.necessary ? 'Medically necessary' : 'Not medically necessary',
  };

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

  // ── Decision rules ───────────────────────────────────────────────────────────
  let recommendation: Recommendation;
  if (!allDocsValid) {
    recommendation = 'MORE_INFO_REQUIRED';
  } else if (!policyActive || claimTypeExcluded || !necessityResult.necessary) {
    recommendation = 'REJECTED';
  } else {
    recommendation = 'APPROVED';
  }

  // For non-approved claims, populate the benefit section immediately so "Pending…" never shows.
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

  // ── Step 4: Benefit Calculation (only when APPROVED) ─────────────────────────
  let benefitResult: ReturnType<typeof calculateBenefit> | null = null;

  if (recommendation === 'APPROVED') {
    yield { type: 'step-start', step: 4, stepName: 'Benefit Calculation' };

    const benefitNextId = `tool-${callIndex + 1}`;
    yield {
      type: 'tool-start',
      toolCallId: benefitNextId,
      toolName: 'calculateBenefit',
      input: { policyId: claim.policyId, claimType: claim.claimType, amount: claim.requestedAmount },
      step: 4,
    };

    benefitResult = record(
      'calculateBenefit',
      { policyId: claim.policyId, claimType: claim.claimType, amount: claim.requestedAmount },
      calculateBenefit({
        policyId: claim.policyId,
        claimType: claim.claimType,
        amount: claim.requestedAmount,
      }),
    );
    const benefitTc = toolCalls[toolCalls.length - 1];

    const benefitLine = benefitResult.success
      ? `✓ Covered amount: $${benefitResult.coveredAmount}`
      : `✗ Benefit calculation failed`;

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
          benefitCalculation:
            benefitResult.success === true
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

    if (!benefitResult.success) {
      recommendation = 'REJECTED';
    }
  }

  // ── Build recommendation reasoning ───────────────────────────────────────────
  const matchedExcl = policyActive && policy ? policy.exclusions.find((e) => e.claimTypes.includes(claim.claimType)) : undefined;
  const matchedCov = policyActive && policy ? policy.coverageClauses.find((c) => c.claimType === claim.claimType) : undefined;

  let reasoningText: string;
  if (recommendation === 'MORE_INFO_REQUIRED') {
    const ids = docResults
      .filter(({ result }) => !result.success || !result.valid)
      .map(({ documentId }) => documentId)
      .join(', ');
    reasoningText = `Document(s) ${ids} are missing or invalid. Valid documentation is required before assessment can proceed.`;
  } else if (recommendation === 'REJECTED') {
    if (!policyActive) {
      reasoningText = `Policy ${claim.policyId} is not active.`;
    } else if (claimTypeExcluded) {
      const excl = policy?.exclusions.find((e) => e.claimTypes.includes(claim.claimType));
      reasoningText = excl
        ? `Claim type "${claim.claimType}" is excluded (${excl.clauseId}): ${excl.description}`
        : `Claim type "${claim.claimType}" is excluded under this policy.`;
    } else {
      reasoningText = `Medical necessity not established. ${necessityResult.rationale}`;
    }
  } else {
    const b = benefitResult?.success ? benefitResult : null;
    reasoningText = b
      ? `All criteria satisfied. Benefit: $${b.coveredAmount} covered at ${b.coveragePercent}% (deductible $${b.deductibleApplied} applied).`
      : 'All criteria met.';
  }

  // Build audit decision mapping
  const decisionMapping: DecisionFactor[] = [];

  decisionMapping.push({
    factor: 'DOCUMENT',
    status: allDocsValid ? 'PASS' : 'FAIL',
    clauseId: null,
    explanation: allDocsValid
      ? `All ${docResults.length} document(s) verified successfully.`
      : `Document(s) ${docResults.filter(({ result }) => !result.success || !result.valid).map(({ documentId }) => documentId).join(', ')} are missing or invalid.`,
  });

  decisionMapping.push({
    factor: 'POLICY',
    status: policyActive && !claimTypeExcluded && matchedCov ? 'PASS' : 'FAIL',
    clauseId: matchedExcl?.clauseId ?? matchedCov?.clauseId ?? null,
    explanation: !policyActive
      ? `Policy ${claim.policyId} is not active.`
      : claimTypeExcluded && matchedExcl
        ? `Claim type "${claim.claimType}" is excluded under clause ${matchedExcl.clauseId}: ${matchedExcl.description}`
        : matchedCov
          ? `Coverage confirmed under clause ${matchedCov.clauseId}.`
          : `No coverage found for claim type "${claim.claimType}".`,
  });

  decisionMapping.push({
    factor: 'MEDICAL',
    status: necessityResult.necessary ? 'PASS' : 'FAIL',
    clauseId: null,
    explanation: necessityResult.necessary
      ? `Medical necessity confirmed. ${necessityResult.rationale}`
      : `Medical necessity not established. ${necessityResult.rationale}`,
  });

  const bFinal = benefitResult?.success ? benefitResult : null;
  decisionMapping.push({
    factor: 'BENEFIT',
    status: bFinal ? 'PASS' : 'FAIL',
    clauseId: matchedCov?.clauseId ?? null,
    explanation: bFinal
      ? `Covered at ${bFinal.coveragePercent}%. Covered amount: $${bFinal.coveredAmount} (deductible $${bFinal.deductibleApplied} applied).`
      : 'Not applicable — claim was not approved or benefit calculation failed.',
  });

  const reasoning: ReasoningSection = {
    summary: reasoningText,
    keyDrivers: decisionMapping.map((d) => {
      const clauseTag = d.clauseId ? ` [${d.clauseId}]` : '';
      return `${d.factor}${clauseTag}: ${d.status} — ${d.explanation}`;
    }),
  };

  yield { type: 'workflow-complete', recommendation, reasoning: reasoningText };

  // Recommendation section appears in the report when the final assessment text finishes typing.
  yield {
    type: 'report-update',
    step: 0,
    stepName: 'Final Assessment',
    partial: {
      claimId: claim.claimId,
      recommendation,
      sections: {
        recommendation: {
          decision: recommendation,
          reasoning: reasoningText,
        },
        decisionMapping,
        reasoning,
      },
    },
  };

  // ── Build the full report ─────────────────────────────────────────────────────
  const report: AssessmentReport = {
    claimId: claim.claimId,
    patientName: claim.patientName,
    assessmentDate: today,
    recommendation,
    sections: {
      documentReview: {
        summary: allDocsValid
          ? `All ${docResults.length} document(s) verified successfully.`
          : `${invalidDocs.length} of ${docResults.length} document(s) failed verification.`,
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
          ? {
              coverages: policy.coverages,
              exclusions: policy.exclusions,
              annualDeductibleMet: policy.annualDeductibleMet,
            }
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
      benefitCalculation:
        benefitResult?.success === true
          ? {
              summary: benefitResult.details,
              requestedAmount: claim.requestedAmount,
              coveredAmount: benefitResult.coveredAmount,
              patientResponsibility: benefitResult.patientResponsibility,
              deductibleApplied: benefitResult.deductibleApplied,
            }
          : {
              summary:
                recommendation === 'APPROVED'
                  ? 'Benefit calculation failed.'
                  : 'Not applicable — claim was not approved.',
              requestedAmount: claim.requestedAmount,
              coveredAmount: 0,
              patientResponsibility: claim.requestedAmount,
              deductibleApplied: 0,
            },
      recommendation: {
        decision: recommendation,
        reasoning: reasoningText,
      },
      policyCitations,
      decisionMapping,
      reasoning,
    },
  };

  const bSummary = benefitResult?.success ? benefitResult : null;
  const summary =
    recommendation === 'APPROVED'
      ? `Claim ${claim.claimId} for ${claim.patientName}: APPROVED. Covered: $${bSummary?.coveredAmount ?? 0} (deductible $${bSummary?.deductibleApplied ?? 0} applied). Patient responsibility: $${bSummary?.patientResponsibility ?? claim.requestedAmount}.`
      : recommendation === 'REJECTED'
        ? `Claim ${claim.claimId} for ${claim.patientName}: REJECTED. ${reasoningText}`
        : `Claim ${claim.claimId} for ${claim.patientName}: MORE INFORMATION REQUIRED. ${reasoningText}`;

  yield { type: 'final-report', report, toolCalls, summary };
}
