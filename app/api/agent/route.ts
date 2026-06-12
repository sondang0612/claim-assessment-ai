import { type NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent/agent';
import { DEFAULT_MODEL, type DeepSeekModel } from '@/lib/providers/deepseek';
import type { ChatMessage } from '@/types/agent';

export const runtime = 'nodejs';

const VALID_MODELS: DeepSeekModel[] = ['deepseek-chat', 'deepseek-reasoner'];

type ToolCallChunk = { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown };
type ToolResultChunk = { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown };

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

  const agentResult = runAgent(messages, model);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of agentResult.fullStream) {
          let event: Record<string, unknown> | null = null;

          if (chunk.type === 'text-delta') {
            event = { type: 'text', text: chunk.text };
          } else if (chunk.type === 'tool-call') {
            const tc = chunk as unknown as ToolCallChunk;
            event = { type: 'tool-call', toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.input };
          } else if (chunk.type === 'tool-result') {
            const tr = chunk as unknown as ToolResultChunk;
            event = { type: 'tool-result', toolCallId: tr.toolCallId, toolName: tr.toolName, output: tr.output };
          }

          if (event !== null) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
