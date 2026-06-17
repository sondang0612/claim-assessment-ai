/**
 * End-to-end claim assessment flow tests.
 * Runs all tool steps in the correct workflow sequence (verify docs → lookup policy →
 * check necessity → calculate benefit) and validates the derived recommendation.
 * No AI API calls — purely domain logic exercised through the tool layer.
 */
import { describe, it, expect } from 'vitest';
import { verifyDocument } from '@/lib/tools/verifyDocument';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';
import type { ClaimType } from '@/types/claims';
import type { Recommendation } from '@/types/report';

/** Pure workflow logic — mirrors the decision rules in lib/workflow/assessmentWorkflow.ts */
function deriveRecommendation(opts: {
  docsAllValid: boolean;
  policyActive: boolean;
  claimNotExcluded: boolean;
  medicallyNecessary: boolean;
  benefitCalculated: boolean;
}): Recommendation {
  if (!opts.docsAllValid) return 'MORE_INFO_REQUIRED';
  if (!opts.policyActive || !opts.claimNotExcluded || !opts.medicallyNecessary) return 'REJECTED';
  if (opts.benefitCalculated) return 'APPROVED';
  return 'REJECTED';
}

describe('Claim assessment flow — Scenario A (CLM-001, APPROVED)', () => {
  it('Step 1: all documents are valid', () => {
    const doc1 = verifyDocument({ documentId: 'DOC-001' });
    const doc2 = verifyDocument({ documentId: 'DOC-002' });
    expect(doc1.success && doc1.valid).toBe(true);
    expect(doc2.success && doc2.valid).toBe(true);
  });

  it('Step 2: POL-001 is active with surgery coverage and no exclusions', () => {
    const result = lookupPolicy({ policyId: 'POL-001' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.policy.status).toBe('active');
    expect(result.policy.exclusions).toHaveLength(0);
    const hasSurgery = result.policy.coverages.some((c) => c.claimType === 'surgery');
    expect(hasSurgery).toBe(true);
  });

  it('Step 3: appendicitis is medically necessary', () => {
    const result = checkMedicalNecessity({ diagnosis: 'appendicitis', procedures: ['44970'] });
    expect(result.necessary).toBe(true);
  });

  it('Step 4: benefit calculates to $4,500 (90% of $5,000, deductible met)', () => {
    const result = calculateBenefit({ policyId: 'POL-001', claimType: 'surgery', amount: 5000 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.coveredAmount).toBe(4500);
  });

  it('full workflow → APPROVED', () => {
    const doc1 = verifyDocument({ documentId: 'DOC-001' });
    const doc2 = verifyDocument({ documentId: 'DOC-002' });
    const policy = lookupPolicy({ policyId: 'POL-001' });
    const necessity = checkMedicalNecessity({ diagnosis: 'appendicitis', procedures: ['44970'] });
    const benefit = calculateBenefit({ policyId: 'POL-001', claimType: 'surgery', amount: 5000 });

    const rec = deriveRecommendation({
      docsAllValid: (doc1.success && doc1.valid) && (doc2.success && doc2.valid),
      policyActive: policy.success && policy.policy.status === 'active',
      claimNotExcluded:
        policy.success && !policy.policy.exclusions.some((e) => e.claimTypes.includes('surgery')),
      medicallyNecessary: necessity.necessary,
      benefitCalculated: benefit.success,
    });
    expect(rec).toBe('APPROVED');
  });
});

describe('Claim assessment flow — Scenario B (CLM-002, REJECTED)', () => {
  it('Step 1: all documents are valid', () => {
    const doc4 = verifyDocument({ documentId: 'DOC-004' });
    const doc5 = verifyDocument({ documentId: 'DOC-005' });
    expect(doc4.success && doc4.valid).toBe(true);
    expect(doc5.success && doc5.valid).toBe(true);
  });

  it('Step 2: POL-002 explicitly excludes "elective" claim type', () => {
    const result = lookupPolicy({ policyId: 'POL-002' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const excluded = result.policy.exclusions.some((e) => e.claimTypes.includes('elective'));
    expect(excluded).toBe(true);
  });

  it('Step 3: elective cosmetic surgery is NOT medically necessary', () => {
    const result = checkMedicalNecessity({
      diagnosis: 'elective cosmetic surgery',
      procedures: ['15829'],
    });
    expect(result.necessary).toBe(false);
  });

  it('Step 4 (skipped): benefit calculation fails — elective type excluded', () => {
    const result = calculateBenefit({
      policyId: 'POL-002',
      claimType: 'elective' as ClaimType,
      amount: 8000,
    });
    expect(result.success).toBe(false);
  });

  it('full workflow → REJECTED', () => {
    const doc4 = verifyDocument({ documentId: 'DOC-004' });
    const doc5 = verifyDocument({ documentId: 'DOC-005' });
    const policy = lookupPolicy({ policyId: 'POL-002' });
    const necessity = checkMedicalNecessity({
      diagnosis: 'elective cosmetic surgery',
      procedures: ['15829'],
    });

    const rec = deriveRecommendation({
      docsAllValid: (doc4.success && doc4.valid) && (doc5.success && doc5.valid),
      policyActive: policy.success && policy.policy.status === 'active',
      claimNotExcluded:
        policy.success && !policy.policy.exclusions.some((e) => e.claimTypes.includes('elective')),
      medicallyNecessary: necessity.necessary,
      benefitCalculated: false,
    });
    expect(rec).toBe('REJECTED');
  });
});

describe('Claim assessment flow — Scenario C (CLM-003, MORE_INFO_REQUIRED)', () => {
  it('Step 1: DOC-003 (itemized bill) is missing — workflow halts here', () => {
    const doc6 = verifyDocument({ documentId: 'DOC-006' });
    const doc3 = verifyDocument({ documentId: 'DOC-003' });
    expect(doc6.success && doc6.valid).toBe(true);
    expect(doc3.success).toBe(true);
    if (doc3.success) expect(doc3.valid).toBe(false);
  });

  it('full workflow → MORE_INFO_REQUIRED regardless of other checks', () => {
    const doc6 = verifyDocument({ documentId: 'DOC-006' });
    const doc3 = verifyDocument({ documentId: 'DOC-003' });

    const rec = deriveRecommendation({
      docsAllValid: (doc6.success && doc6.valid) && (doc3.success && doc3.valid),
      policyActive: true,
      claimNotExcluded: true,
      medicallyNecessary: true,
      benefitCalculated: true,
    });
    expect(rec).toBe('MORE_INFO_REQUIRED');
  });
});
