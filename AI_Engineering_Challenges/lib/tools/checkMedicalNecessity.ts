import { findNecessityRule } from '@/lib/data/medicalCodes';

export interface CheckMedicalNecessityInput {
  diagnosis: string;
  procedures: string[];
}

export interface CheckMedicalNecessityResult {
  necessary: boolean;
  rationale: string;
  approvedProcedures: string[];
  requestedProcedures: string[];
  /** Procedures in the request that are not covered under the matched rule */
  unapprovedProcedures: string[];
}

export function checkMedicalNecessity(
  input: CheckMedicalNecessityInput,
): CheckMedicalNecessityResult {
  const rule = findNecessityRule(input.diagnosis);

  if (!rule) {
    return {
      necessary: false,
      rationale: `No established medical necessity rule found for "${input.diagnosis}". Manual clinical review required.`,
      approvedProcedures: [],
      requestedProcedures: input.procedures,
      unapprovedProcedures: [...input.procedures],
    };
  }

  const unapprovedProcedures = rule.necessary
    ? input.procedures.filter((p) => !rule.approvedProcedures.includes(p))
    : [...input.procedures];

  return {
    necessary: rule.necessary,
    rationale: rule.rationale,
    approvedProcedures: rule.approvedProcedures,
    requestedProcedures: input.procedures,
    unapprovedProcedures,
  };
}
