import { type NextRequest } from 'next/server';
import { classifyRequest, HELP_MESSAGE } from '@/lib/classifier/requestClassifier';
import { parseClaim } from '@/lib/parser/claimParser';
import { streamAssessmentWorkflow } from '@/lib/workflow/assessmentWorkflow';
import { DEFAULT_MODEL, type DeepSeekModel } from '@/lib/providers/deepseek';
import type { ChatMessage } from '@/types/agent';
import type { WorkflowEvent } from '@/types/workflow';

export const runtime = 'nodejs';

const VALID_MODELS: DeepSeekModel[] = ['deepseek-chat', 'deepseek-reasoner'];

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

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

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return Response.json({ error: 'No user message found in history' }, { status: 400 });
  }

  const { messageClass } = classifyRequest(lastUserMessage.content);
  console.log(`[api/agent] classified message as: ${messageClass}`);

  const encoder = new TextEncoder();

  function sseChunk(event: WorkflowEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Non-claim messages: single event, no LLM call
      if (messageClass !== 'claim_request') {
        controller.enqueue(sseChunk({ type: 'message', messageClass, summary: HELP_MESSAGE }));
        controller.close();
        return;
      }

      try {
        const parsedClaim = await parseClaim(lastUserMessage.content, model);
        console.log(`[api/agent] parsed claim=${parsedClaim.claimId} policy=${parsedClaim.policyId}`);

        for await (const event of streamAssessmentWorkflow(parsedClaim)) {
          controller.enqueue(sseChunk(event));
          if (event.type === 'final-report') {
            console.log(`[api/agent] assessment complete recommendation=${event.report.recommendation}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Assessment failed';
        console.error('[api/agent] error:', error);
        controller.enqueue(sseChunk({ type: 'error', message }));
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
