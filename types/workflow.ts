import type { AssessmentReport, PartialAssessmentReport, Recommendation } from './report';

export interface WorkflowToolCall {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: 'done' | 'running' | 'completed' | 'failed';
}

export type WorkflowEvent =
  | { type: 'workflow-start'; claimId: string }
  | { type: 'step-start'; step: number; stepName: string }
  /** Emitted before each tool call — lets the UI show a RUNNING indicator immediately. */
  | { type: 'tool-start'; toolCallId: string; toolName: string; input: Record<string, unknown>; step: number }
  /** Emitted after a tool returns — carries the result and the human-readable line. */
  | { type: 'tool-complete'; toolCall: WorkflowToolCall; line: string; step: number }
  | { type: 'step-result'; toolCall: WorkflowToolCall; line: string }
  | { type: 'step-complete'; step: number; stepName: string; summary: string }
  /** Partial report snapshot after a step finishes — drives progressive report rendering. */
  | { type: 'report-update'; partial: PartialAssessmentReport; step: number; stepName: string }
  | { type: 'workflow-complete'; recommendation: Recommendation; reasoning: string }
  | { type: 'final-report'; report: AssessmentReport; toolCalls: WorkflowToolCall[]; summary: string }
  | { type: 'error'; message: string }
  | { type: 'message'; messageClass: string; summary: string };
