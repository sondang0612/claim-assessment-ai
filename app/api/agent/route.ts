import { type NextRequest } from 'next/server';
import { classifyRequest, HELP_MESSAGE } from '@/lib/classifier/requestClassifier';
import { parseClaim } from '@/lib/parser/claimParser';
import { runAssessmentWorkflow } from '@/lib/workflow/assessmentWorkflow';
import { DEFAULT_MODEL, type DeepSeekModel } from '@/lib/providers/deepseek';
import type { ChatMessage } from '@/types/agent';

export const runtime = 'nodejs';

const VALID_MODELS: DeepSeekModel[] = ['deepseek-chat', 'deepseek-reasoner'];

export async function POST(request: NextRequest) {
  let messages: ChatMessage[];
  let model: DeepSeekModel;

  try {
    const body = (await request.json()) as { messages?: unknown; model?: unknown };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 },
      );
    }

    messages = body.messages as ChatMessage[];

    const requested = body.model as string | undefined;
    model =
      requested && (VALID_MODELS as string[]).includes(requested)
        ? (requested as DeepSeekModel)
        : DEFAULT_MODEL;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Extract the most recent user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return Response.json({ error: 'No user message found in history' }, { status: 400 });
  }

  // Classify the message before attempting any LLM call or claim parsing
  const { messageClass } = classifyRequest(lastUserMessage.content);
  console.log(`[api/agent] classified message as: ${messageClass}`);

  // Non-claim messages receive a static help response — no LLM call needed
  if (messageClass !== 'claim_request') {
    return Response.json({ messageClass, summary: HELP_MESSAGE });
  }

  try {
    // LLM parses structured claim fields from the user message — no tool calls, no decisions
    const parsedClaim = await parseClaim(lastUserMessage.content, model);
    console.log(`[api/agent] parsed claim=${parsedClaim.claimId} policy=${parsedClaim.policyId}`);

    // Deterministic workflow executes all assessment steps in TypeScript
    const result = runAssessmentWorkflow(parsedClaim);
    console.log(`[api/agent] assessment complete recommendation=${result.report.recommendation}`);

    return Response.json({
      messageClass,
      report: result.report,
      toolCalls: result.toolCalls,
      summary: result.summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assessment failed';
    console.error('[api/agent] error:', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
