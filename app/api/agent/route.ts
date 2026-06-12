import { type NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent/agent';
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

  const result = runAgent(messages, model);
  return result.toTextStreamResponse();
}
