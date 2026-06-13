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
    const report = JSON.parse(match[1].trim()) as AssessmentReport;
    // LLMs sometimes emit objects instead of plain strings in the codes array.
    // Normalize here so the render layer always receives string[].
    const rawCodes = report.sections?.medicalNecessity?.codes;
    if (Array.isArray(rawCodes)) {
      report.sections.medicalNecessity.codes = (rawCodes as unknown[]).map((c) => {
        if (typeof c === 'string') return c;
        if (typeof c === 'object' && c !== null) {
          const obj = c as Record<string, unknown>;
          return String(obj.code ?? obj.name ?? obj.id ?? JSON.stringify(c));
        }
        return String(c);
      });
    }
    return report;
  } catch {
    return null;
  }
}
