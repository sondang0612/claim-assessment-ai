"use client";

import { useState, useRef, useCallback } from "react";
import type { AssessmentReport } from "@/types/report";
import type { ToolCallEntry } from "./ToolCallLog";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ToolCallLog from "./ToolCallLog";
import AssessmentReportView from "../report/AssessmentReport";

type DeepSeekModel = "deepseek-chat" | "deepseek-reasoner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentResponse {
  messageClass?: 'claim_request' | 'greeting' | 'help_request' | 'unsupported';
  report?: AssessmentReport;
  toolCalls?: ToolCallEntry[];
  summary?: string;
  error?: string;
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<DeepSeekModel>("deepseek-chat");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      const userMsg: Message = { role: "user", content };
      const nextMessages = [...messages, userMsg];

      setMessages([...nextMessages, { role: "assistant", content: "Assessing claim…" }]);
      setToolCalls([]);
      setReport(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, model }),
          signal: controller.signal,
        });

        const data = (await res.json()) as AgentResponse;

        if (!res.ok || data.error) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        setMessages([
          ...nextMessages,
          { role: "assistant", content: data.summary ?? "Assessment complete." },
        ]);

        if (data.toolCalls) setToolCalls(data.toolCalls);
        if (data.report) setReport(data.report);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages([...nextMessages, { role: "assistant", content: "Assessment cancelled." }]);
          return;
        }
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content:
              "An error occurred. Please check that DEEPSEEK_API_KEY is set in .env.local and try again.",
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
            <h1 className="text-base font-bold text-gray-900">
              Claim Assessment AI
            </h1>
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

        {/* Tool call log */}
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
