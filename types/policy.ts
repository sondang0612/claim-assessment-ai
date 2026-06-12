import type { ClaimType } from './claims';

export type PolicyStatus = 'active' | 'inactive' | 'suspended';

export interface Coverage {
  claimType: ClaimType;
  /** Percentage of eligible expenses covered (0–100) */
  coveragePercent: number;
  /** Maximum benefit in USD */
  maxBenefit: number;
  /** Per-claim deductible in USD */
  deductible: number;
  requiresPreAuth: boolean;
}

export interface Exclusion {
  description: string;
  claimTypes: ClaimType[];
  /** ICD-10 codes that trigger this exclusion */
  icdCodes?: string[];
}

export interface Policy {
  policyId: string;
  holderName: string;
  /** ISO date string */
  effectiveDate: string;
  /** ISO date string */
  expirationDate: string;
  status: PolicyStatus;
  coverages: Coverage[];
  exclusions: Exclusion[];
  /** True when the annual deductible has already been met for this policy year */
  annualDeductibleMet: boolean;
  notes?: string;
}
