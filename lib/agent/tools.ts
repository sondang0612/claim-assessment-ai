import { tool } from 'ai';
import { z } from 'zod';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';
import { verifyDocument } from '@/lib/tools/verifyDocument';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';

// AI SDK v6 uses `inputSchema` (not `parameters`) and `execute(input)` (not destructured)
export const agentTools = {
  verifyDocument: tool({
    description:
      'Verify a claim document by its document ID. Returns validity status, document type, issuing provider, issue date, and any issues found. Call this FIRST for every document associated with the claim.',
    inputSchema: z.object({
      documentId: z.string().describe('Document identifier, e.g. "DOC-001"'),
    }),
    execute: async (input) => verifyDocument(input),
  }),

  lookupPolicy: tool({
    description:
      'Look up an insurance policy by policy ID. Returns coverage types, percentages, deductibles, exclusions, and policy status. Call this after document verification.',
    inputSchema: z.object({
      policyId: z.string().describe('Policy identifier, e.g. "POL-001"'),
    }),
    execute: async (input) => lookupPolicy(input),
  }),

  checkMedicalNecessity: tool({
    description:
      'Check whether a patient diagnosis and associated procedures are medically necessary. Returns a necessity determination, clinical rationale, approved CPT codes, and any unapproved procedures. Call this after policy lookup.',
    inputSchema: z.object({
      diagnosis: z
        .string()
        .describe('Patient diagnosis — ICD-10 code or plain-language description'),
      procedures: z
        .array(z.string())
        .describe('CPT procedure codes requested in this claim'),
    }),
    execute: async (input) => checkMedicalNecessity(input),
  }),

  calculateBenefit: tool({
    description:
      'Calculate the benefit amount for a claim. Returns covered amount, patient responsibility, and deductible applied. Only call this after confirming all documents are valid, the policy covers the claim type, and medical necessity is confirmed.',
    inputSchema: z.object({
      policyId: z.string().describe('Policy identifier'),
      claimType: z
        .enum(['hospitalization', 'surgery', 'outpatient', 'emergency', 'preventive', 'elective'])
        .describe('Type of medical claim'),
      amount: z.number().describe('Total requested claim amount in USD'),
    }),
    execute: async (input) => calculateBenefit(input),
  }),
};
