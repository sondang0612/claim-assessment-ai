import { verifyDocument } from '@/lib/tools/verifyDocument';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';
import type { ParsedClaim } from '@/lib/parser/claimParser';
import type { AssessmentReport, DocumentFinding, Recommendation } from '@/types/report';

/** Mirrors the ToolCallEntry shape from ToolCallLog for JSON serialization */
interface WorkflowToolCall {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: 'done';
}

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
  const policyCitations: Array<{ section: string; text: string }> = [];
  if (policy?.notes) {
    policyCitations.push({ section: 'Policy Notes', text: policy.notes });
  }
  if (claimTypeExcluded && policy) {
    const excl = policy.exclusions.find((e) => e.claimTypes.includes(claim.claimType));
    if (excl) policyCitations.push({ section: 'Exclusion', text: excl.description });
  }

  // Build recommendation reasoning
  let reasoning: string;
  if (recommendation === 'MORE_INFO_REQUIRED') {
    const ids = docFindings
      .filter((f) => f.status !== 'valid')
      .map((f) => f.documentId)
      .join(', ');
    reasoning = `Document(s) ${ids} are missing or invalid. Valid documentation is required before assessment can proceed.`;
  } else if (recommendation === 'REJECTED') {
    if (!policyActive) {
      reasoning = `Policy ${claim.policyId} is not active.`;
    } else if (claimTypeExcluded) {
      const excl = policy?.exclusions.find((e) => e.claimTypes.includes(claim.claimType));
      reasoning = excl
        ? `Claim type "${claim.claimType}" is excluded: ${excl.description}`
        : `Claim type "${claim.claimType}" is excluded under this policy.`;
    } else {
      reasoning = `Medical necessity not established. ${necessityResult.rationale}`;
    }
  } else {
    const b = benefitResult?.success ? benefitResult : null;
    reasoning = b
      ? `All criteria satisfied. Benefit: $${b.coveredAmount} covered at ${b.coveragePercent}% (deductible $${b.deductibleApplied} applied).`
      : 'All criteria met.';
  }

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
        reasoning,
      },
      policyCitations,
    },
  };

  const b = benefitResult?.success ? benefitResult : null;
  const summary =
    recommendation === 'APPROVED'
      ? `Claim ${claim.claimId} for ${claim.patientName}: APPROVED. Covered: $${b?.coveredAmount ?? 0} (deductible $${b?.deductibleApplied ?? 0} applied). Patient responsibility: $${b?.patientResponsibility ?? claim.requestedAmount}.`
      : recommendation === 'REJECTED'
        ? `Claim ${claim.claimId} for ${claim.patientName}: REJECTED. ${reasoning}`
        : `Claim ${claim.claimId} for ${claim.patientName}: MORE INFORMATION REQUIRED. ${reasoning}`;

  return { report, toolCalls, summary };
}
