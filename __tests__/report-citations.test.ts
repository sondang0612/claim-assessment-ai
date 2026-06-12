/**
 * Report generation and policy citations validation tests.
 * Verifies that parseReportFromText correctly reconstructs structured reports,
 * and that policy data contains the citation-worthy text the agent is expected
 * to quote in its <report> block.
 */
import { describe, it, expect } from 'vitest';
import { parseReportFromText } from '@/lib/report/generateReport';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import type { AssessmentReport, Recommendation, PolicyCitation } from '@/types/report';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReport(
  recommendation: Recommendation,
  policyId: string,
  policyCitations: PolicyCitation[],
  overrides: Partial<AssessmentReport> = {},
): AssessmentReport {
  return {
    claimId: 'CLM-TEST',
    patientName: 'Test Patient',
    assessmentDate: '2026-06-12',
    recommendation,
    sections: {
      documentReview: { summary: 'Documents reviewed.', findings: [] },
      policyVerification: {
        summary: 'Policy verified.',
        policyId,
        holderName: 'Test Patient',
        status: 'active',
        coverageDetails: { coveragePercent: 90 },
      },
      medicalNecessity: { summary: 'Necessity assessed.', necessary: true, rationale: 'Required.' },
      benefitCalculation: {
        summary: 'Benefit calculated.',
        requestedAmount: 5000,
        coveredAmount: 4500,
        patientResponsibility: 500,
        deductibleApplied: 0,
      },
      recommendation: { decision: recommendation, reasoning: 'Based on assessment.' },
      policyCitations,
    },
    ...overrides,
  };
}

// ─── Report generation ────────────────────────────────────────────────────────

describe('Report generation — parsing', () => {
  it('parses APPROVED report with correct financial figures', () => {
    const report = buildReport('APPROVED', 'POL-001', [
      { section: 'Surgery coverage', text: '90% coverage up to $30,000.' },
    ]);
    const parsed = parseReportFromText(`<report>${JSON.stringify(report)}</report>`);

    expect(parsed?.recommendation).toBe('APPROVED');
    expect(parsed?.sections.benefitCalculation.coveredAmount).toBe(4500);
    expect(parsed?.sections.benefitCalculation.patientResponsibility).toBe(500);
    expect(parsed?.sections.benefitCalculation.deductibleApplied).toBe(0);
  });

  it('parses REJECTED report with exclusion citation', () => {
    const exclusionText =
      'Elective and cosmetic procedures are not covered under this plan (Section 4.2).';
    const report = buildReport('REJECTED', 'POL-002', [
      { section: 'Exclusions — Section 4.2', text: exclusionText },
    ]);
    const parsed = parseReportFromText(`<report>${JSON.stringify(report)}</report>`);

    expect(parsed?.recommendation).toBe('REJECTED');
    expect(parsed?.sections.policyCitations[0].text).toContain('not covered');
    expect(parsed?.sections.policyCitations[0].section).toContain('4.2');
  });

  it('parses MORE_INFO_REQUIRED report with missing document finding', () => {
    const report = buildReport('MORE_INFO_REQUIRED', 'POL-003', [], {
      sections: {
        ...buildReport('MORE_INFO_REQUIRED', 'POL-003', []).sections,
        documentReview: {
          summary: 'Itemized bill (DOC-003) is missing.',
          findings: [
            {
              documentId: 'DOC-003',
              documentType: 'itemized_bill',
              status: 'missing',
              issues: ['Itemized bill has not been submitted.'],
            },
          ],
        },
        recommendation: {
          decision: 'MORE_INFO_REQUIRED',
          reasoning: 'Missing itemized bill required under Section 3.1.',
        },
      },
    });
    const parsed = parseReportFromText(`<report>${JSON.stringify(report)}</report>`);

    expect(parsed?.recommendation).toBe('MORE_INFO_REQUIRED');
    expect(parsed?.sections.documentReview.findings[0].documentId).toBe('DOC-003');
    expect(parsed?.sections.documentReview.findings[0].status).toBe('missing');
  });

  it('preserves all fields across serialise → parse round-trip', () => {
    const report = buildReport('APPROVED', 'POL-001', [
      { section: 'Surgery', text: '90% covered.' },
    ]);
    const parsed = parseReportFromText(`<report>${JSON.stringify(report)}</report>`);

    expect(parsed?.claimId).toBe(report.claimId);
    expect(parsed?.patientName).toBe(report.patientName);
    expect(parsed?.assessmentDate).toBe(report.assessmentDate);
    expect(parsed?.sections.policyVerification.policyId).toBe('POL-001');
  });
});

// ─── Policy citations validation ──────────────────────────────────────────────

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

  it('report with multiple citations preserves order and content', () => {
    const citations: PolicyCitation[] = [
      { section: 'Section 2.1 — Surgery Coverage', text: '90% coverage up to $30,000.' },
      { section: 'Section 1.4 — Deductibles', text: 'Annual deductible applies per calendar year.' },
      { section: 'Section 5.2 — Network', text: 'In-network providers receive preferred rates.' },
    ];
    const report = buildReport('APPROVED', 'POL-001', citations);
    const parsed = parseReportFromText(`<report>${JSON.stringify(report)}</report>`);

    expect(parsed?.sections.policyCitations).toHaveLength(3);
    expect(parsed?.sections.policyCitations[0].section).toContain('Surgery');
    expect(parsed?.sections.policyCitations[1].section).toContain('Deductibles');
    expect(parsed?.sections.policyCitations[2].text).toContain('In-network');
  });
});
