/**
 * Report citations tests.
 * Verifies that the assessment workflow produces correct policy citations derived
 * from structured policy data, and that the source policy data is citation-worthy.
 */
import { describe, it, expect } from 'vitest';
import { runAssessmentWorkflow } from '@/lib/workflow/assessmentWorkflow';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import type { ParsedClaim } from '@/lib/parser/claimParser';
import type { PolicyCitation } from '@/types/report';

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

// ─── Workflow citation generation ─────────────────────────────────────────────

describe('Report citations — workflow output', () => {
  it('CLM-001 approved report includes policy notes citation', () => {
    const { report } = runAssessmentWorkflow(CLM_001);
    const citations = report.sections.policyCitations;
    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0].section).toBe('Policy Notes');
    expect(citations[0].text.length).toBeGreaterThan(10);
  });

  it('CLM-002 rejected report includes exclusion citation', () => {
    const { report } = runAssessmentWorkflow(CLM_002);
    const citations = report.sections.policyCitations;
    const exclusionCitation = citations.find((c: PolicyCitation) =>
      c.section === 'Exclusion',
    );
    expect(exclusionCitation).toBeDefined();
    expect(exclusionCitation?.text).toMatch(/elective/i);
    expect(exclusionCitation?.text).toMatch(/not covered/i);
  });

  it('CLM-001 report round-trip — financial figures are preserved', () => {
    const { report } = runAssessmentWorkflow(CLM_001);
    const bc = report.sections.benefitCalculation;
    expect(bc.coveredAmount).toBe(4500);
    expect(bc.patientResponsibility).toBe(500);
    expect(bc.deductibleApplied).toBe(0);
    expect(bc.requestedAmount).toBe(5000);
  });

  it('CLM-003 more-info report has no exclusion citation', () => {
    const { report } = runAssessmentWorkflow(CLM_003);
    const exclusionCitation = report.sections.policyCitations.find(
      (c: PolicyCitation) => c.section === 'Exclusion',
    );
    expect(exclusionCitation).toBeUndefined();
  });

  it('CLM-001 report preserves all identity fields', () => {
    const { report } = runAssessmentWorkflow(CLM_001);
    expect(report.claimId).toBe('CLM-001');
    expect(report.patientName).toBe('John Doe');
    expect(report.assessmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.sections.policyVerification.policyId).toBe('POL-001');
  });
});

// ─── Policy citations source data validation ──────────────────────────────────

describe('Policy citations — source data validation', () => {
  it('POL-001 notes field is non-empty and suitable for citations', () => {
    const result = lookupPolicy({ policyId: 'POL-001' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.policy.notes).toBeDefined();
    expect((result.policy.notes ?? '').length).toBeGreaterThan(10);
  });

  it('POL-002 exclusion description is verbatim citation-worthy text', () => {
    const result = lookupPolicy({ policyId: 'POL-002' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const excl = result.policy.exclusions[0];
    expect(excl.description).toMatch(/elective/i);
    expect(excl.description).toMatch(/not covered/i);
  });

  it('POL-002 exclusion has associated ICD codes for citations', () => {
    const result = lookupPolicy({ policyId: 'POL-002' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const excl = result.policy.exclusions[0];
    expect(excl.icdCodes).toBeDefined();
    expect((excl.icdCodes ?? []).length).toBeGreaterThan(0);
  });

  it('POL-003 notes reference itemized bill and a section number', () => {
    const result = lookupPolicy({ policyId: 'POL-003' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.policy.notes).toMatch(/itemized bill/i);
    expect(result.policy.notes).toMatch(/section/i);
  });
});
