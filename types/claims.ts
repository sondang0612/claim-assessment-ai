export type ClaimType =
  | 'hospitalization'
  | 'surgery'
  | 'outpatient'
  | 'emergency'
  | 'preventive'
  | 'elective';

export type DocumentType =
  | 'medical_bill'
  | 'itemized_bill'
  | 'discharge_summary'
  | 'prescription'
  | 'referral'
  | 'lab_report'
  | 'imaging_report';

export type DocumentStatus = 'valid' | 'invalid' | 'missing' | 'expired';

export interface Document {
  documentId: string;
  claimId: string;
  documentType: DocumentType;
  status: DocumentStatus;
  issuedDate: string;
  provider: string;
  issues?: string[];
}

export interface Claim {
  claimId: string;
  policyId: string;
  patientName: string;
  submissionDate: string;
  claimType: ClaimType;
  /** ICD-10 code or plain-language diagnosis */
  diagnosis: string;
  /** CPT procedure codes */
  procedures: string[];
  requestedAmount: number;
  documentIds: string[];
}
