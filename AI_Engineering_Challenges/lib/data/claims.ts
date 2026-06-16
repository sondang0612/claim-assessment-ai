import type { Claim } from '@/types/claims';

/** Reference data for the three built-in test scenarios. */
export const CLAIMS: Record<string, Claim> = {
  // Scenario A — full approval
  'CLM-001': {
    claimId: 'CLM-001',
    policyId: 'POL-001',
    patientName: 'John Doe',
    submissionDate: '2026-05-22',
    claimType: 'surgery',
    diagnosis: 'appendicitis',
    procedures: ['44970'],
    requestedAmount: 5000,
    documentIds: ['DOC-001', 'DOC-002'],
  },

  // Scenario B — rejection (elective exclusion)
  'CLM-002': {
    claimId: 'CLM-002',
    policyId: 'POL-002',
    patientName: 'Jane Smith',
    submissionDate: '2026-06-03',
    claimType: 'elective',
    diagnosis: 'elective cosmetic surgery',
    procedures: ['15829'],
    requestedAmount: 8000,
    documentIds: ['DOC-004', 'DOC-005'],
  },

  // Scenario C — more info required (missing itemized bill)
  'CLM-003': {
    claimId: 'CLM-003',
    policyId: 'POL-003',
    patientName: 'Bob Johnson',
    submissionDate: '2026-06-07',
    claimType: 'surgery',
    diagnosis: 'fracture',
    procedures: ['27244'],
    requestedAmount: 12000,
    documentIds: ['DOC-006', 'DOC-003'],
  },
};

export function getClaimById(claimId: string): Claim | undefined {
  return CLAIMS[claimId];
}
