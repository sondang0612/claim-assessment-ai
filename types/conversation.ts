import type { ClaimEvent } from './report';

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
  /** Append-only log of every assessment run; same claimId may appear multiple times. */
  claimEvents: ClaimEvent[];
  createdAt: string;
  updatedAt: string;
}
