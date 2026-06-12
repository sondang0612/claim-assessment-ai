import { type NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent/agent';
import type { ChatMessage } from '@/types/agent';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let messages: ChatMessage[];

  try {
    const body = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 },
      );
    }
    messages = body.messages as ChatMessage[];
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = runAgent(messages);
  // AI SDK v6: toTextStreamResponse replaces toDataStreamResponse
  return result.toTextStreamResponse();
}
