import { getPolicyById } from '@/lib/data/policies';
import type { ClaimType } from '@/types/claims';

export interface CalculateBenefitInput {
  policyId: string;
  claimType: ClaimType;
  amount: number;
}

export type CalculateBenefitResult =
  | {
      success: true;
      coveredAmount: number;
      patientResponsibility: number;
      deductibleApplied: number;
      coveragePercent: number;
      details: string;
    }
  | { success: false; error: string };

export function calculateBenefit(input: CalculateBenefitInput): CalculateBenefitResult {
  const policy = getPolicyById(input.policyId);
  if (!policy) {
    return { success: false, error: `Policy "${input.policyId}" not found.` };
  }

  // Exclusion check takes priority over coverage lookup
  const matchedExclusion = policy.exclusions.find((excl) =>
    excl.claimTypes.includes(input.claimType),
  );
  if (matchedExclusion) {
    return {
      success: false,
      error: `Claim type "${input.claimType}" is excluded: ${matchedExclusion.description}`,
    };
  }

  const coverage = policy.coverages.find((c) => c.claimType === input.claimType);
  if (!coverage) {
    return {
      success: false,
      error: `Policy "${input.policyId}" has no coverage for claim type "${input.claimType}".`,
    };
  }

  const deductibleApplied = policy.annualDeductibleMet ? 0 : coverage.deductible;
  const amountAfterDeductible = Math.max(0, input.amount - deductibleApplied);
  const rawCovered = amountAfterDeductible * (coverage.coveragePercent / 100);
  const coveredAmount = Math.min(rawCovered, coverage.maxBenefit);
  const patientResponsibility = input.amount - coveredAmount;

  return {
    success: true,
    coveredAmount: Math.round(coveredAmount * 100) / 100,
    patientResponsibility: Math.round(patientResponsibility * 100) / 100,
    deductibleApplied,
    coveragePercent: coverage.coveragePercent,
    details: `${coverage.coveragePercent}% coverage applied. Deductible: $${deductibleApplied}. Max benefit cap: $${coverage.maxBenefit}.`,
  };
}
