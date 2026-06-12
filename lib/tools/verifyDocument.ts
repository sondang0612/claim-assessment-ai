import { getDocumentById } from '@/lib/data/documents';
import type { DocumentType } from '@/types/claims';

export interface VerifyDocumentInput {
  documentId: string;
}

export type VerifyDocumentResult =
  | {
      success: true;
      valid: boolean;
      documentType: DocumentType;
      provider: string;
      issuedDate: string;
      issues: string[];
    }
  | { success: false; error: string };

export function verifyDocument(input: VerifyDocumentInput): VerifyDocumentResult {
  const doc = getDocumentById(input.documentId);
  if (!doc) {
    return { success: false, error: `Document "${input.documentId}" not found in system.` };
  }
  return {
    success: true,
    valid: doc.status === 'valid',
    documentType: doc.documentType,
    provider: doc.provider,
    issuedDate: doc.issuedDate,
    issues: doc.issues ?? [],
  };
}
