export interface NecessityRule {
  /** ICD-10 code or normalized plain-language diagnosis */
  diagnosis: string;
  necessary: boolean;
  rationale: string;
  /** CPT codes considered medically necessary for this diagnosis */
  approvedProcedures: string[];
}

export const MEDICAL_NECESSITY_RULES: NecessityRule[] = [
  {
    diagnosis: 'K37',
    necessary: true,
    rationale:
      'Appendectomy is a medically necessary emergency surgical procedure for acute appendicitis.',
    approvedProcedures: ['44950', '44960', '44970'],
  },
  {
    diagnosis: 'appendicitis',
    necessary: true,
    rationale:
      'Appendectomy is a medically necessary emergency surgical procedure for acute appendicitis.',
    approvedProcedures: ['44950', '44960', '44970'],
  },
  {
    diagnosis: 'Z41.1',
    necessary: false,
    rationale:
      'Face-lift and cosmetic rhinoplasty procedures are elective and not medically necessary.',
    approvedProcedures: [],
  },
  {
    diagnosis: 'elective cosmetic surgery',
    necessary: false,
    rationale: 'Elective cosmetic surgery is not medically necessary.',
    approvedProcedures: [],
  },
  {
    diagnosis: 'cosmetic',
    necessary: false,
    rationale: 'Cosmetic procedures are elective and not medically necessary.',
    approvedProcedures: [],
  },
  {
    diagnosis: 'S72.001A',
    necessary: true,
    rationale: 'Open reduction and internal fixation of femoral fracture is medically necessary.',
    approvedProcedures: ['27244', '27245'],
  },
  {
    diagnosis: 'fracture',
    necessary: true,
    rationale: 'Surgical repair of a fracture is medically necessary.',
    approvedProcedures: ['27244', '27245'],
  },
];

/**
 * Find a necessity rule by matching the diagnosis string (case-insensitive, substring match).
 * Returns the first matching rule; more specific ICD codes should appear before plain-language
 * entries in MEDICAL_NECESSITY_RULES to ensure the most accurate match.
 */
export function findNecessityRule(diagnosis: string): NecessityRule | undefined {
  const normalized = diagnosis.toLowerCase();
  return MEDICAL_NECESSITY_RULES.find(
    (rule) =>
      normalized.includes(rule.diagnosis.toLowerCase()) ||
      rule.diagnosis.toLowerCase().includes(normalized),
  );
}
