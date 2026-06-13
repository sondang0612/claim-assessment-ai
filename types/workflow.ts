import type { AssessmentReport, Recommendation } from './report';

/** Mirrors the ToolCallEntry shape from ToolCallLog — included in SSE step-result events. */
export interface WorkflowToolCall {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: 'done';
}

export type WorkflowEvent =
  | { type: 'workflow-start'; claimId: string }
  | { type: 'step-start'; step: number; stepName: string }
  | { type: 'step-result'; toolCall: WorkflowToolCall; line: string }
  | { type: 'step-complete'; step: number; stepName: string; summary: string }
  | { type: 'workflow-complete'; recommendation: Recommendation; reasoning: string }
  | { type: 'final-report'; report: AssessmentReport; toolCalls: WorkflowToolCall[]; summary: string }
  | { type: 'error'; message: string }
  | { type: 'message'; messageClass: string; summary: string };
