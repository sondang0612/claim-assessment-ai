import { streamText, stepCountIs } from 'ai';
import { getDeepSeekModel, type DeepSeekModel, DEFAULT_MODEL } from '@/lib/providers/deepseek';
import { agentTools } from './tools';
import { SYSTEM_PROMPT } from './prompts';
import type { ChatMessage } from '@/types/agent';

/**
 * Runs the claim assessment agent with the given message history.
 *
 * @param messages  Chat history — user/assistant turns
 * @param model     DeepSeek model to use (default: deepseek-chat)
 *
 * Returns a streamText result; callers use .toTextStreamResponse() for SSE.
 * Requires DEEPSEEK_API_KEY to be set in the environment.
 */
export function runAgent(messages: ChatMessage[], model: DeepSeekModel = DEFAULT_MODEL) {
  return streamText({
    model: getDeepSeekModel(model),
    system: SYSTEM_PROMPT,
    messages,
    tools: agentTools,
    stopWhen: stepCountIs(10),
    onStepFinish(step) {
      for (const call of step.toolCalls) {
        console.log(`[agent:tool] step=${step.stepNumber} model=${model} tool=${call.toolName}`);
      }
      if (step.text.length > 0) {
        console.log(`[agent:text] step=${step.stepNumber} length=${step.text.length}`);
      }
    },
  });
}
