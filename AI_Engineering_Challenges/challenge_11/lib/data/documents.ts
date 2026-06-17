import type { Document } from '@/types/claims';

export const DOCUMENTS: Record<string, Document> = {
  // CLM-001 — John Doe, appendicitis (all documents valid)
  'DOC-001': {
    documentId: 'DOC-001',
    claimId: 'CLM-001',
    documentType: 'discharge_summary',
    status: 'valid',
    issuedDate: '2026-05-20',
    provider: 'City General Hospital',
  },
  'DOC-002': {
    documentId: 'DOC-002',
    claimId: 'CLM-001',
    documentType: 'itemized_bill',
    status: 'valid',
    issuedDate: '2026-05-21',
    provider: 'City General Hospital',
  },

  // CLM-002 — Jane Smith, elective cosmetic surgery (valid docs, excluded claim type)
  'DOC-004': {
    documentId: 'DOC-004',
    claimId: 'CLM-002',
    documentType: 'medical_bill',
    status: 'valid',
    issuedDate: '2026-06-01',
    provider: 'Aesthetic Clinic',
  },
  'DOC-005': {
    documentId: 'DOC-005',
    claimId: 'CLM-002',
    documentType: 'referral',
    status: 'valid',
    issuedDate: '2026-05-28',
    provider: 'Primary Care Associates',
  },

  // CLM-003 — Bob Johnson, surgery (discharge summary valid, itemized bill missing)
  'DOC-006': {
    documentId: 'DOC-006',
    claimId: 'CLM-003',
    documentType: 'discharge_summary',
    status: 'valid',
    issuedDate: '2026-06-05',
    provider: 'Metro Medical Center',
  },
  'DOC-003': {
    documentId: 'DOC-003',
    claimId: 'CLM-003',
    documentType: 'itemized_bill',
    status: 'missing',
    issuedDate: '',
    provider: '',
    issues: [
      'Itemized bill has not been submitted. Required for all surgical claims under Section 3.1.',
    ],
  },
};

export function getDocumentById(documentId: string): Document | undefined {
  return DOCUMENTS[documentId];
}

export function getDocumentsByClaimId(claimId: string): Document[] {
  return Object.values(DOCUMENTS).filter((d) => d.claimId === claimId);
}
