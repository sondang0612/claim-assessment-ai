/**
 * Tool calling execution flow tests.
 * Validates each tool's error handling, edge cases, and boundary conditions
 * beyond what the per-scenario tests cover.
 */
import { describe, it, expect } from 'vitest';
import { verifyDocument } from '@/lib/tools/verifyDocument';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';

// ─── verifyDocument ──────────────────────────────────────────────────────────

describe('verifyDocument — execution', () => {
  it('returns success:false with error message for unknown document IDs', () => {
    const result = verifyDocument({ documentId: 'DOC-UNKNOWN' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });

  it('returns all required fields on success', () => {
    const result = verifyDocument({ documentId: 'DOC-001' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.valid).toBe(true);
    expect(typeof result.documentType).toBe('string');
    expect(typeof result.provider).toBe('string');
    expect(typeof result.issuedDate).toBe('string');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('returns valid:false and a non-empty issues array for a missing document', () => {
    const result = verifyDocument({ documentId: 'DOC-003' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('issues list is empty for a fully valid document', () => {
    const result = verifyDocument({ documentId: 'DOC-002' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ─── lookupPolicy ────────────────────────────────────────────────────────────

describe('lookupPolicy — execution', () => {
  it('returns success:false with error message for unknown policy IDs', () => {
    const result = lookupPolicy({ policyId: 'POL-UNKNOWN' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });

  it('returns policy with at least one coverage entry', () => {
    for (const id of ['POL-001', 'POL-002', 'POL-003']) {
      const result = lookupPolicy({ policyId: id });
      expect(result.success).toBe(true);
      if (!result.success) continue;
      expect(result.policy.coverages.length).toBeGreaterThan(0);
    }
  });

  it('POL-002 has exactly one exclusion covering "elective"', () => {
    const result = lookupPolicy({ policyId: 'POL-002' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.policy.exclusions).toHaveLength(1);
    expect(result.policy.exclusions[0].claimTypes).toContain('elective');
  });

  it('all 3 policies are in active status', () => {
    for (const id of ['POL-001', 'POL-002', 'POL-003']) {
      const result = lookupPolicy({ policyId: id });
      expect(result.success).toBe(true);
      if (!result.success) continue;
      expect(result.policy.status).toBe('active');
    }
  });
});

// ─── checkMedicalNecessity ───────────────────────────────────────────────────

describe('checkMedicalNecessity — execution', () => {
  it('marks completely unknown diagnosis as not necessary (requires manual review)', () => {
    const result = checkMedicalNecessity({
      diagnosis: 'unknown-condition-xyz',
      procedures: ['99999'],
    });
    expect(result.necessary).toBe(false);
    expect(result.unapprovedProcedures).toContain('99999');
    expect(result.rationale).toMatch(/manual.*review|no.*rule/i);
  });

  it('approved procedures are not listed in unapprovedProcedures', () => {
    const result = checkMedicalNecessity({
      diagnosis: 'appendicitis',
      procedures: ['44970'],
    });
    expect(result.necessary).toBe(true);
    expect(result.unapprovedProcedures).not.toContain('44970');
    expect(result.approvedProcedures).toContain('44970');
  });

  it('unapproved procedures within a necessary diagnosis are flagged', () => {
    // appendicitis is necessary, but CPT 99999 is not an approved procedure for it
    const result = checkMedicalNecessity({
      diagnosis: 'appendicitis',
      procedures: ['44970', '99999'],
    });
    expect(result.necessary).toBe(true);
    expect(result.unapprovedProcedures).toContain('99999');
    expect(result.unapprovedProcedures).not.toContain('44970');
  });

  it('all procedures are unapproved when diagnosis is not necessary', () => {
    const result = checkMedicalNecessity({
      diagnosis: 'elective cosmetic surgery',
      procedures: ['15829', '15830'],
    });
    expect(result.necessary).toBe(false);
    expect(result.unapprovedProcedures).toContain('15829');
    expect(result.unapprovedProcedures).toContain('15830');
  });
});

// ─── calculateBenefit ────────────────────────────────────────────────────────

describe('calculateBenefit — execution', () => {
  it('returns success:false for unknown policy IDs', () => {
    const result = calculateBenefit({ policyId: 'POL-UNKNOWN', claimType: 'surgery', amount: 1000 });
    expect(result.success).toBe(false);
  });

  it('returns success:false for a claim type not covered by the policy', () => {
    // POL-002 covers hospitalization + outpatient, NOT surgery
    const result = calculateBenefit({ policyId: 'POL-002', claimType: 'surgery', amount: 5000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it('returns success:false with "excluded" in error when claim type is excluded', () => {
    const result = calculateBenefit({ policyId: 'POL-002', claimType: 'elective', amount: 8000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/excluded/i);
  });

  it('applies per-claim deductible when annual deductible not yet met', () => {
    // POL-003 surgery: deductible=$750, not met
    const result = calculateBenefit({ policyId: 'POL-003', claimType: 'surgery', amount: 1000 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // (1000 - 750) * 0.85 = 212.5
    expect(result.deductibleApplied).toBe(750);
    expect(result.coveredAmount).toBe(212.5);
    expect(result.patientResponsibility).toBe(787.5);
  });

  it('skips deductible when annual deductible already met', () => {
    // POL-001: annualDeductibleMet=true
    const result = calculateBenefit({ policyId: 'POL-001', claimType: 'surgery', amount: 1000 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // 1000 * 0.90 = 900
    expect(result.deductibleApplied).toBe(0);
    expect(result.coveredAmount).toBe(900);
  });

  it('caps covered amount at maxBenefit ceiling', () => {
    // POL-001 surgery maxBenefit=$30,000; 90% of $40,000 = $36,000 → capped at $30,000
    const result = calculateBenefit({ policyId: 'POL-001', claimType: 'surgery', amount: 40000 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.coveredAmount).toBe(30000);
    expect(result.patientResponsibility).toBe(10000);
  });

  it('covered amount is $0 when deductible equals or exceeds the claim amount', () => {
    // POL-003 surgery deductible=$750; claim amount=$500 → after deductible = 0
    const result = calculateBenefit({ policyId: 'POL-003', claimType: 'surgery', amount: 500 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.coveredAmount).toBe(0);
    expect(result.patientResponsibility).toBe(500);
  });
});
