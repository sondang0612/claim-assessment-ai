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
  /** Unique clause identifier (e.g. EX-01) for audit tracing */
  clauseId: string;
  description: string;
  claimTypes: ClaimType[];
  /** ICD-10 codes that trigger this exclusion */
  icdCodes?: string[];
}

/** A named policy clause that can be cited in audit trails */
export interface CoverageClause {
  /** Unique clause identifier (e.g. CV-01, CV-02) */
  clauseId: string;
  claimType: ClaimType;
  type: 'coverage' | 'limit';
  description: string;
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
  /** Structured coverage clauses for audit tracing */
  coverageClauses: CoverageClause[];
  /** True when the annual deductible has already been met for this policy year */
  annualDeductibleMet: boolean;
  notes?: string;
}
