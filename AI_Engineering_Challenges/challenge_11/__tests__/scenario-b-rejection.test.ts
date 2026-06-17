/**
 * Scenario B — CLM-002 (Jane Smith, POL-002, elective cosmetic surgery)
 * Expected outcome: REJECTED — elective claim type excluded by policy + not medically necessary
 */
import { describe, it, expect } from 'vitest';
import { verifyDocument } from '@/lib/tools/verifyDocument';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';

describe('Scenario B — Rejection (CLM-002, Jane Smith, elective cosmetic surgery)', () => {
  describe('Step 1: Document verification', () => {
    it('DOC-004 (medical bill) is valid', () => {
      const result = verifyDocument({ documentId: 'DOC-004' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.valid).toBe(true);
      expect(result.documentType).toBe('medical_bill');
    });

    it('DOC-005 (referral) is valid', () => {
      const result = verifyDocument({ documentId: 'DOC-005' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.valid).toBe(true);
      expect(result.documentType).toBe('referral');
    });
  });

  describe('Step 2: Policy lookup', () => {
    it('POL-002 explicitly excludes elective claim type', () => {
      const result = lookupPolicy({ policyId: 'POL-002' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.policy.exclusions).toHaveLength(1);
      expect(result.policy.exclusions[0].claimTypes).toContain('elective');
      expect(result.policy.exclusions[0].description).toMatch(/elective/i);
    });

    it('POL-002 has NO surgery coverage (only hospitalization and outpatient)', () => {
      const result = lookupPolicy({ policyId: 'POL-002' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      const claimTypes = result.policy.coverages.map((c) => c.claimType);
      expect(claimTypes).not.toContain('surgery');
      expect(claimTypes).not.toContain('elective');
    });
  });

  describe('Step 3: Medical necessity', () => {
    it('elective cosmetic surgery is NOT medically necessary', () => {
      const result = checkMedicalNecessity({
        diagnosis: 'elective cosmetic surgery',
        procedures: ['15829'],
      });
      expect(result.necessary).toBe(false);
      expect(result.unapprovedProcedures).toContain('15829');
      expect(result.rationale).toMatch(/elective|cosmetic/i);
    });
  });

  describe('Step 4: Benefit calculation (blocked — exclusion)', () => {
    it('returns error — elective type is excluded from POL-002', () => {
      const result = calculateBenefit({
        policyId: 'POL-002',
        claimType: 'elective',
        amount: 8000,
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/excluded/i);
    });
  });
});
