export type Recommendation = 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUIRED';

export type DecisionFactorType = 'DOCUMENT' | 'POLICY' | 'MEDICAL' | 'BENEFIT';
export type DecisionFactorStatus = 'PASS' | 'FAIL';

/** One entry in the audit decision trail, tracing each factor to a clause when applicable. */
export interface DecisionFactor {
  factor: DecisionFactorType;
  status: DecisionFactorStatus;
  /** clauseId from policy data — null for non-policy factors (documents, medical) */
  clauseId: string | null;
  explanation: string;
}

export interface ReasoningSection {
  summary: string;
  keyDrivers: string[];
}

export interface PolicyCitation {
  /** Clause identifier from policy data (e.g. EX-01, CV-02); null for free-text notes */
  clauseId: string | null;
  type: 'exclusion' | 'coverage' | 'limit' | 'notes';
  section: string;
  text: string;
}

export interface DocumentFinding {
  documentId: string;
  documentType: string;
  status: string;
  issues?: string[];
}

export interface DocumentReviewSection {
  summary: string;
  findings: DocumentFinding[];
}

export interface PolicyVerificationSection {
  summary: string;
  policyId: string;
  holderName: string;
  status: string;
  coverageDetails: Record<string, unknown>;
}

export interface MedicalNecessitySection {
  summary: string;
  necessary: boolean;
  rationale: string;
  codes?: string[];
}

export interface BenefitCalculationSection {
  summary: string;
  requestedAmount: number;
  coveredAmount: number;
  patientResponsibility: number;
  deductibleApplied: number;
}

export interface RecommendationSection {
  decision: Recommendation;
  reasoning: string;
}

export interface AssessmentReport {
  claimId: string;
  patientName: string;
  /** ISO date string */
  assessmentDate: string;
  recommendation: Recommendation;
  sections: {
    documentReview: DocumentReviewSection;
    policyVerification: PolicyVerificationSection;
    medicalNecessity: MedicalNecessitySection;
    benefitCalculation: BenefitCalculationSection;
    recommendation: RecommendationSection;
    policyCitations: PolicyCitation[];
    decisionMapping: DecisionFactor[];
    reasoning: ReasoningSection;
  };
}

/** Sections present so far during progressive streaming; each field is absent until its step completes. */
export type PartialAssessmentSections = Partial<{
  documentReview: DocumentReviewSection;
  policyVerification: PolicyVerificationSection;
  medicalNecessity: MedicalNecessitySection;
  benefitCalculation: BenefitCalculationSection;
  recommendation: RecommendationSection;
  policyCitations: PolicyCitation[];
  decisionMapping: DecisionFactor[];
  reasoning: ReasoningSection;
}>;

/** Grows incrementally via report-update events; structurally assignable from AssessmentReport. */
export interface PartialAssessmentReport {
  claimId: string;
  patientName?: string;
  assessmentDate?: string;
  recommendation?: Recommendation;
  sections: PartialAssessmentSections;
}

/** One assessment run — same claimId can appear multiple times as separate events. */
export interface ClaimEvent {
  /** Client-generated UUID; unique per assessment run regardless of claimId. */
  eventId: string;
  claimId: string;
  /** ISO timestamp of when the assessment started. */
  timestamp: string;
  report: PartialAssessmentReport;
}
