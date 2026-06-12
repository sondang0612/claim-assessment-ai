import { streamText, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { agentTools } from './tools';
import { SYSTEM_PROMPT } from './prompts';
import type { ChatMessage } from '@/types/agent';

/**
 * Runs the claim assessment agent with the given message history.
 * Returns a streamText result; callers use .toTextStreamResponse() for SSE.
 *
 * Requires ANTHROPIC_API_KEY to be set in the environment.
 */
export function runAgent(messages: ChatMessage[]) {
  return streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SYSTEM_PROMPT,
    messages,
    tools: agentTools,
    // AI SDK v6: stopWhen replaces maxSteps
    stopWhen: stepCountIs(10),
    onStepFinish(step) {
      // Server-side tool call logging for audit trail
      for (const call of step.toolCalls) {
        console.log(`[agent:tool] step=${step.stepNumber} tool=${call.toolName}`);
      }
      if (step.text.length > 0) {
        console.log(`[agent:text] step=${step.stepNumber} length=${step.text.length}`);
      }
    },
  });
}
