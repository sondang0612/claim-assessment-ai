import type { AssessmentReport } from '@/types/report';

/**
 * Extracts and parses the structured <report>…</report> JSON block
 * that the agent appends to its final message.
 *
 * Returns null if no valid block is found or the JSON is malformed.
 * The block is expected to contain a single JSON object matching AssessmentReport.
 */
export function parseReportFromText(text: string): AssessmentReport | null {
  const match = text.match(/<report>([\s\S]*?)<\/report>/);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1].trim()) as AssessmentReport;
  } catch {
    return null;
  }
}
