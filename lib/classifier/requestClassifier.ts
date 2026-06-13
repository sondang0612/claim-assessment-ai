export type MessageClass = 'claim_request' | 'greeting' | 'help_request' | 'unsupported';

export interface ClassificationResult {
  messageClass: MessageClass;
}

export const HELP_MESSAGE = `Hello! I'm the Papaya Insurtech claim assessment AI agent. I'm ready to help you evaluate a medical insurance claim.

To get started, please provide me with the following information:

1. Claim ID
2. Patient Name
3. Document IDs associated with the claim
4. Policy ID
5. Diagnosis and procedure codes (if available)
6. Claim type (hospitalization, surgery, outpatient, emergency, preventive, or elective)
7. Requested claim amount

Please share these details so I can begin the assessment workflow!`;

// ── Claim indicator patterns ──────────────────────────────────────────────────

/** Unambiguous structured identifiers — presence alone confirms a claim request */
const RE_CLAIM_ID = /\bCLM-\w+/i;
const RE_POLICY_ID = /\bPOL-\w+/i;
const RE_DOC_ID = /\bDOC-\w+/i;

/** Medical/insurance domain vocabulary (weaker signal — requires pairing) */
const RE_DOMAIN_TERMS =
  /\b(claim|diagnosis|procedure|surgery|hospitalization|outpatient|emergency|preventive|elective|deductible|coverage|discharge|itemized)\b/i;

/** Financial amount patterns — $500, 5000 USD, 5,000 dollars */
const RE_AMOUNT = /\$\s?\d[\d,]*|\b\d[\d,]*\s*(dollars?|usd)\b/i;

/** CPT procedure codes are always exactly 5 digits */
const RE_CPT_CODE = /\b\d{5}\b/;

/** ICD-10 codes: letter + 2 digits, optional decimal extension (e.g. K37, E11.9) */
const RE_ICD_CODE = /\b[A-Z]\d{2}(?:\.\d+)?\b/;

// ── Greeting patterns ─────────────────────────────────────────────────────────

const GREETING_PATTERNS: RegExp[] = [
  /^\s*(hi+|hello+|hey+|hola|bonjour|ciao|howdy|greetings|salut|yo)\b/i,
  /\bxin\s*ch[àa]o\b/i,
  /\bgood\s*(morning|afternoon|evening|day)\b/i,
  /\bhow\s+are\s+you\b/i,
  /\bwhat'?s\s+up\b/i,
  /\bnice\s+to\s+meet\s+you\b/i,
];

// ── Help request patterns ─────────────────────────────────────────────────────

const HELP_PATTERNS: RegExp[] = [
  /\bhelp\b/i,
  /\bhow\s+(does\s+this\s+work|do\s+(i|you))\b/i,
  /\bwhat\s+can\s+you\s+(do|help)\b/i,
  /\bwhat\s+(information|details?|data|fields?)\s+(do\s+i|should\s+i|is\s+needed|are\s+needed|do\s+you\s+need)\b/i,
  /\b(instructions?|guide|tutorial)\b/i,
  /\bhow\s+to\s+use\b/i,
  /\bget\s+started\b/i,
  /\bwhat\s+(do|should)\s+i\s+(provide|submit|include|send|need)\b/i,
];

// ── Classification logic ──────────────────────────────────────────────────────

function hasClaimIndicators(message: string): boolean {
  // Explicit structured IDs are unambiguous
  if (RE_CLAIM_ID.test(message) || RE_POLICY_ID.test(message) || RE_DOC_ID.test(message)) {
    return true;
  }
  // Domain vocabulary + financial or medical code context
  return (
    RE_DOMAIN_TERMS.test(message) &&
    (RE_AMOUNT.test(message) || RE_CPT_CODE.test(message) || RE_ICD_CODE.test(message))
  );
}

/**
 * Classifies a user message into one of four categories using deterministic
 * regex matching — no LLM call is made.
 *
 * Priority: claim_request > greeting > help_request > unsupported
 * Claim indicators always win so "Hi, please assess CLM-001" routes correctly.
 */
export function classifyRequest(message: string): ClassificationResult {
  if (hasClaimIndicators(message)) return { messageClass: 'claim_request' };
  if (GREETING_PATTERNS.some((r) => r.test(message))) return { messageClass: 'greeting' };
  if (HELP_PATTERNS.some((r) => r.test(message))) return { messageClass: 'help_request' };
  return { messageClass: 'unsupported' };
}
