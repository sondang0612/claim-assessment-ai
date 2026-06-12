'use client';

import { useState, useRef, useCallback } from 'react';
import { parseReportFromText } from '@/lib/report/generateReport';
import type { AssessmentReport } from '@/types/report';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ToolCallLog, { type ToolCallEntry } from './ToolCallLog';
import AssessmentReportView from '../report/AssessmentReport';

type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type SSEEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown }
  | { type: 'error'; message: string };

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<DeepSeekModel>('deepseek-chat');
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      const userMsg: Message = { role: 'user', content };
      const nextMessages = [...messages, userMsg];

      setMessages([...nextMessages, { role: 'assistant', content: '' }]);
      setToolCalls([]);
      setReport(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let assistantText = '';

      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages, model }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;

            let event: SSEEvent;
            try {
              event = JSON.parse(raw) as SSEEvent;
            } catch {
              continue;
            }

            if (event.type === 'text') {
              assistantText += event.text;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: assistantText },
              ]);
            } else if (event.type === 'tool-call') {
              setToolCalls((prev) => [
                ...prev,
                {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  input: event.input,
                  status: 'calling',
                },
              ]);
            } else if (event.type === 'tool-result') {
              setToolCalls((prev) =>
                prev.map((tc) =>
                  tc.toolCallId === event.toolCallId
                    ? { ...tc, output: event.output, status: 'done' }
                    : tc,
                ),
              );
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          }
        }

        // Extract and strip the <report> block from the displayed text
        const parsed = parseReportFromText(assistantText);
        if (parsed) {
          setReport(parsed);
          const clean = assistantText.replace(/<report>[\s\S]*?<\/report>/g, '').trim();
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: clean },
          ]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content:
              'An error occurred. Please check that DEEPSEEK_API_KEY is set in .env.local and try again.',
          },
        ]);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, model, isStreaming],
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Left: chat panel ── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200 bg-white">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h1 className="text-base font-bold text-gray-900">Claim Assessment AI</h1>
            <p className="text-xs text-gray-400">
              Powered by DeepSeek ·{' '}
              <span className="font-mono">{model}</span>
            </p>
          </div>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-blue-500">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Assessing…
            </span>
          )}
        </header>

        {/* Messages */}
        <MessageList messages={messages} isStreaming={isStreaming} />

        {/* Tool call log (only while/after streaming) */}
        {toolCalls.length > 0 && <ToolCallLog toolCalls={toolCalls} />}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          isStreaming={isStreaming}
          model={model}
          onModelChange={setModel}
          onAbort={() => abortRef.current?.abort()}
        />
      </div>

      {/* ── Right: report panel ── */}
      <div className="w-96 xl:w-[480px] flex flex-col bg-gray-50 overflow-y-auto flex-shrink-0">
        {report ? (
          <AssessmentReportView report={report} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-gray-400 text-xl">📊</span>
              </div>
              <p className="text-sm text-gray-400 font-medium">No report yet</p>
              <p className="text-xs text-gray-300 mt-1">
                Submit a claim assessment to see the structured report here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
