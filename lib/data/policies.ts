import type { Policy } from '@/types/policy';

export const POLICIES: Record<string, Policy> = {
  'POL-001': {
    policyId: 'POL-001',
    holderName: 'John Doe',
    effectiveDate: '2025-01-01',
    expirationDate: '2026-12-31',
    status: 'active',
    annualDeductibleMet: true,
    coverages: [
      {
        claimType: 'hospitalization',
        coveragePercent: 90,
        maxBenefit: 50000,
        deductible: 500,
        requiresPreAuth: false,
      },
      {
        claimType: 'surgery',
        coveragePercent: 90,
        maxBenefit: 30000,
        deductible: 500,
        requiresPreAuth: true,
      },
      {
        claimType: 'emergency',
        coveragePercent: 100,
        maxBenefit: 10000,
        deductible: 0,
        requiresPreAuth: false,
      },
    ],
    exclusions: [],
    notes: 'Comprehensive plan — full inpatient, surgical, and emergency coverage.',
  },

  'POL-002': {
    policyId: 'POL-002',
    holderName: 'Jane Smith',
    effectiveDate: '2025-03-01',
    expirationDate: '2026-02-28',
    status: 'active',
    annualDeductibleMet: false,
    coverages: [
      {
        claimType: 'hospitalization',
        coveragePercent: 80,
        maxBenefit: 40000,
        deductible: 1000,
        requiresPreAuth: false,
      },
      {
        claimType: 'outpatient',
        coveragePercent: 70,
        maxBenefit: 5000,
        deductible: 200,
        requiresPreAuth: false,
      },
    ],
    exclusions: [
      {
        description: 'Elective and cosmetic procedures are not covered under this plan.',
        claimTypes: ['elective'],
        icdCodes: ['Z41.1', 'Z41.8'],
      },
    ],
    notes: 'Standard plan — excludes all elective and cosmetic procedures (Section 4.2).',
  },

  'POL-003': {
    policyId: 'POL-003',
    holderName: 'Bob Johnson',
    effectiveDate: '2024-06-01',
    expirationDate: '2026-05-31',
    status: 'active',
    annualDeductibleMet: false,
    coverages: [
      {
        claimType: 'hospitalization',
        coveragePercent: 85,
        maxBenefit: 45000,
        deductible: 750,
        requiresPreAuth: false,
      },
      {
        claimType: 'surgery',
        coveragePercent: 85,
        maxBenefit: 25000,
        deductible: 750,
        requiresPreAuth: true,
      },
    ],
    exclusions: [],
    notes: 'Standard Plus plan — requires itemized bill for all surgical claims (Section 3.1).',
  },
};

export function getPolicyById(policyId: string): Policy | undefined {
  return POLICIES[policyId];
}
