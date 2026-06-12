/**
 * Unit tests for parseReportFromText — the report extraction utility.
 */
import { describe, it, expect } from 'vitest';
import { parseReportFromText } from '@/lib/report/generateReport';
import type { AssessmentReport } from '@/types/report';

const SAMPLE: AssessmentReport = {
  claimId: 'CLM-001',
  patientName: 'John Doe',
  assessmentDate: '2026-06-12',
  recommendation: 'APPROVED',
  sections: {
    documentReview: { summary: 'All documents valid.', findings: [] },
    policyVerification: {
      summary: 'Policy active.',
      policyId: 'POL-001',
      holderName: 'John Doe',
      status: 'active',
      coverageDetails: { claimType: 'surgery', coveragePercent: 90 },
    },
    medicalNecessity: {
      summary: 'Medically necessary.',
      necessary: true,
      rationale: 'Emergency appendectomy.',
      codes: ['44970'],
    },
    benefitCalculation: {
      summary: '$4,500 covered.',
      requestedAmount: 5000,
      coveredAmount: 4500,
      patientResponsibility: 500,
      deductibleApplied: 0,
    },
    recommendation: { decision: 'APPROVED', reasoning: 'All criteria met.' },
    policyCitations: [{ section: 'Surgery coverage', text: '90% coverage up to $30,000.' }],
  },
};

describe('parseReportFromText', () => {
  it('parses a valid <report> block embedded in assistant text', () => {
    const text = `Here is the assessment summary.\n\n<report>\n${JSON.stringify(SAMPLE)}\n</report>`;
    const result = parseReportFromText(text);
    expect(result).not.toBeNull();
    expect(result?.recommendation).toBe('APPROVED');
    expect(result?.claimId).toBe('CLM-001');
    expect(result?.patientName).toBe('John Doe');
  });

  it('returns null when no <report> tag is present', () => {
    expect(parseReportFromText('No structured report here.')).toBeNull();
  });

  it('returns null for malformed JSON inside <report>', () => {
    expect(parseReportFromText('<report>{ not valid json </report>')).toBeNull();
  });

  it('extracts correct numeric values from sections', () => {
    const text = `<report>${JSON.stringify(SAMPLE)}</report>`;
    const result = parseReportFromText(text);
    expect(result?.sections.benefitCalculation.coveredAmount).toBe(4500);
    expect(result?.sections.benefitCalculation.patientResponsibility).toBe(500);
    expect(result?.sections.benefitCalculation.deductibleApplied).toBe(0);
  });

  it('extracts policy citations array', () => {
    const text = `<report>${JSON.stringify(SAMPLE)}</report>`;
    const result = parseReportFromText(text);
    expect(result?.sections.policyCitations).toHaveLength(1);
    expect(result?.sections.policyCitations[0].section).toBe('Surgery coverage');
  });

  it('handles whitespace inside <report> tags', () => {
    const text = `<report>   \n${JSON.stringify(SAMPLE)}\n   </report>`;
    const result = parseReportFromText(text);
    expect(result).not.toBeNull();
  });

  it('returns REJECTED recommendation correctly', () => {
    const rejected: AssessmentReport = {
      ...SAMPLE,
      recommendation: 'REJECTED',
      sections: {
        ...SAMPLE.sections,
        recommendation: { decision: 'REJECTED', reasoning: 'Elective procedure excluded.' },
      },
    };
    const text = `<report>${JSON.stringify(rejected)}</report>`;
    const result = parseReportFromText(text);
    expect(result?.recommendation).toBe('REJECTED');
  });

  it('returns MORE_INFO_REQUIRED recommendation correctly', () => {
    const moreInfo: AssessmentReport = {
      ...SAMPLE,
      recommendation: 'MORE_INFO_REQUIRED',
      sections: {
        ...SAMPLE.sections,
        recommendation: { decision: 'MORE_INFO_REQUIRED', reasoning: 'Missing itemized bill.' },
      },
    };
    const text = `<report>${JSON.stringify(moreInfo)}</report>`;
    const result = parseReportFromText(text);
    expect(result?.recommendation).toBe('MORE_INFO_REQUIRED');
  });
});
