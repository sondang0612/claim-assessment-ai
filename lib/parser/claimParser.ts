import { generateText } from 'ai';
import { z } from 'zod';
import { getDeepSeekModel, DEFAULT_MODEL, type DeepSeekModel } from '@/lib/providers/deepseek';

export const ParsedClaimSchema = z.object({
  claimId: z.string(),
  policyId: z.string(),
  patientName: z.string(),
  documentIds: z.array(z.string()),
  claimType: z.enum(['hospitalization', 'surgery', 'outpatient', 'emergency', 'preventive', 'elective']),
  diagnosis: z.string(),
  procedures: z.array(z.string()),
  requestedAmount: z.number(),
});

export type ParsedClaim = z.infer<typeof ParsedClaimSchema>;

// DeepSeek does not support response_format: json_schema — use generateText + JSON.parse instead of generateObject
const PARSER_SYSTEM = `You are a claim data extractor for an insurance company.
Extract all insurance claim fields from the user message and return ONLY a valid JSON object.

Required JSON structure:
{
  "claimId": "string (e.g. CLM-001)",
  "policyId": "string (e.g. POL-001)",
  "patientName": "string",
  "documentIds": ["string (e.g. DOC-001)"],
  "claimType": "hospitalization | surgery | outpatient | emergency | preventive | elective",
  "diagnosis": "string",
  "procedures": ["string (CPT codes)"],
  "requestedAmount": number
}

Return ONLY the JSON object. No markdown code fences. No commentary.`;

export async function parseClaim(
  userMessage: string,
  model: DeepSeekModel = DEFAULT_MODEL,
): Promise<ParsedClaim> {
  const { text } = await generateText({
    model: getDeepSeekModel(model),
    system: PARSER_SYSTEM,
    prompt: userMessage,
  });

  // Strip markdown code fences in case the model wraps output despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  const raw = JSON.parse(cleaned) as unknown;
  return ParsedClaimSchema.parse(raw);
}
