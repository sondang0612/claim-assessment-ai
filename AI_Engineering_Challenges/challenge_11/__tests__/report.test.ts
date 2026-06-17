/**
 * Assessment workflow report tests.
 * Verifies that the deterministic workflow produces structurally correct
 * AssessmentReport objects for all 3 claim scenarios.
 */
import { describe, it, expect } from 'vitest';
import { runAssessmentWorkflow } from '@/lib/workflow/assessmentWorkflow';
import type { ParsedClaim } from '@/lib/parser/claimParser';

const CLM_001: ParsedClaim = {
  claimId: 'CLM-001',
  policyId: 'POL-001',
  patientName: 'John Doe',
  documentIds: ['DOC-001', 'DOC-002'],
  claimType: 'surgery',
  diagnosis: 'appendicitis',
  procedures: ['44970'],
  requestedAmount: 5000,
};

const CLM_002: ParsedClaim = {
  claimId: 'CLM-002',
  policyId: 'POL-002',
  patientName: 'Jane Smith',
  documentIds: ['DOC-004', 'DOC-005'],
  claimType: 'elective',
  diagnosis: 'elective cosmetic surgery',
  procedures: ['15829'],
  requestedAmount: 8000,
};

const CLM_003: ParsedClaim = {
  claimId: 'CLM-003',
  policyId: 'POL-003',
  patientName: 'Bob Johnson',
  documentIds: ['DOC-006', 'DOC-003'],
  claimType: 'surgery',
  diagnosis: 'fracture',
  procedures: ['27244'],
  requestedAmount: 12000,
};

describe('runAssessmentWorkflow — CLM-001 (APPROVED)', () => {
  const result = runAssessmentWorkflow(CLM_001);

  it('returns APPROVED recommendation', () => {
    expect(result.report.recommendation).toBe('APPROVED');
    expect(result.report.sections.recommendation.decision).toBe('APPROVED');
  });

  it('report contains correct claimId, patientName, and assessmentDate', () => {
    expect(result.report.claimId).toBe('CLM-001');
    expect(result.report.patientName).toBe('John Doe');
    expect(result.report.assessmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('benefit calculation is present with correct covered amount', () => {
    expect(result.report.sections.benefitCalculation.coveredAmount).toBe(4500);
    expect(result.report.sections.benefitCalculation.requestedAmount).toBe(5000);
  });

  it('all document findings are valid', () => {
    const findings = result.report.sections.documentReview.findings;
    expect(findings.every((f) => f.status === 'valid')).toBe(true);
  });

  it('policy citations include policy notes', () => {
    expect(result.report.sections.policyCitations.length).toBeGreaterThan(0);
  });

  it('tool call log includes all 4 steps in order', () => {
    const names = result.toolCalls.map((t) => t.toolName);
    expect(names).toContain('verifyDocument');
    expect(names).toContain('lookupPolicy');
    expect(names).toContain('checkMedicalNecessity');
    expect(names).toContain('calculateBenefit');
  });

  it('all tool calls have status done', () => {
    expect(result.toolCalls.every((t) => t.status === 'done')).toBe(true);
  });
});

describe('runAssessmentWorkflow — CLM-002 (REJECTED)', () => {
  const result = runAssessmentWorkflow(CLM_002);

  it('returns REJECTED recommendation', () => {
    expect(result.report.recommendation).toBe('REJECTED');
  });

  it('does not call calculateBenefit', () => {
    const names = result.toolCalls.map((t) => t.toolName);
    expect(names).not.toContain('calculateBenefit');
  });

  it('policy citations include the exclusion text', () => {
    const citations = result.report.sections.policyCitations;
    expect(citations.some((c) => c.text.toLowerCase().includes('elective'))).toBe(true);
  });

  it('reasoning references the exclusion', () => {
    expect(result.report.sections.recommendation.reasoning).toContain('elective');
  });

  it('summary text identifies the claim as REJECTED', () => {
    expect(result.summary).toContain('REJECTED');
    expect(result.summary).toContain('CLM-002');
  });
});

describe('runAssessmentWorkflow — CLM-003 (MORE_INFO_REQUIRED)', () => {
  const result = runAssessmentWorkflow(CLM_003);

  it('returns MORE_INFO_REQUIRED recommendation', () => {
    expect(result.report.recommendation).toBe('MORE_INFO_REQUIRED');
  });

  it('document findings include at least one non-valid document', () => {
    const findings = result.report.sections.documentReview.findings;
    expect(findings.some((f) => f.status !== 'valid')).toBe(true);
  });

  it('does not call calculateBenefit', () => {
    const names = result.toolCalls.map((t) => t.toolName);
    expect(names).not.toContain('calculateBenefit');
  });

  it('coveredAmount is 0 when claim is not approved', () => {
    expect(result.report.sections.benefitCalculation.coveredAmount).toBe(0);
  });
});
