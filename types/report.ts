export type Recommendation = 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUIRED';

export interface PolicyCitation {
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
  };
}
