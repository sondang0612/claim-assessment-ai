import type { PartialAssessmentReport } from './report';

export interface Conversation {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
    output?: unknown;
    status: 'running' | 'calling' | 'completed' | 'done' | 'failed' | 'error';
  }>;
  workflowSteps: Array<{
    step: number;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  report: PartialAssessmentReport | null;
  createdAt: string;
  updatedAt: string;
}
