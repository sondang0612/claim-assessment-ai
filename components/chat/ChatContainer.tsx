"use client";

import { useState, useRef, useCallback } from "react";
import type { AssessmentReport } from "@/types/report";
import type { WorkflowEvent } from "@/types/workflow";
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

/**
 * Characters revealed per animation frame (~60 fps → ~300 chars/sec).
 * Increasing this makes typing feel faster; decreasing makes it slower.
 */
const CHARS_PER_FRAME = 5;

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<DeepSeekModel>("deepseek-chat");

  const abortRef = useRef<AbortController | null>(null);

  // ── Typing-queue refs ────────────────────────────────────────────────────────
  // These are shared between the async SSE reader and the synchronous RAF loop.
  // Refs are used here instead of state to avoid stale-closure issues — both
  // sides mutate them in-place and read the latest values directly.
  const pendingRef      = useRef("");          // text waiting to be revealed
  const displayedRef    = useRef("");          // text currently shown in the bubble
  const baseMessagesRef = useRef<Message[]>([]); // history snapshot (no assistant slot)
  const rafIdRef        = useRef<number | null>(null);
  const typingActiveRef = useRef(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      // ── Reset typing state from any previous turn ──────────────────────────
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingRef.current   = "";
      displayedRef.current = "";
      typingActiveRef.current = false;

      const userMsg: Message = { role: "user", content };
      const nextMessages = [...messages, userMsg];
      baseMessagesRef.current = nextMessages; // snapshot the RAF loop builds on

      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      setToolCalls([]);
      setReport(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      /**
       * Signals that the SSE stream has fully closed.  The RAF tick reads this
       * (via JS closure-by-reference on a `let`) to know when it is safe to
       * call setIsStreaming(false) after draining the last pending characters.
       */
      let sseComplete = false;

      // ── RAF typing loop ──────────────────────────────────────────────────────
      // Defined inside sendMessage so it closes over `sseComplete` and the
      // stable refs.  Self-schedules via requestAnimationFrame until pending
      // text is empty and SSE is done.
      function tick() {
        if (pendingRef.current.length === 0) {
          // Queue is empty — stop the loop.
          typingActiveRef.current = false;
          rafIdRef.current = null;
          // If SSE finished before the queue drained, end streaming now.
          if (sseComplete) setIsStreaming(false);
          return;
        }

        const chunk = pendingRef.current.slice(0, CHARS_PER_FRAME);
        pendingRef.current = pendingRef.current.slice(CHARS_PER_FRAME);
        displayedRef.current += chunk;

        // One setMessages call per frame — keeps re-renders at ~60 fps.
        setMessages([
          ...baseMessagesRef.current,
          { role: "assistant", content: displayedRef.current },
        ]);

        rafIdRef.current = requestAnimationFrame(tick);
      }

      /** Append text to the queue and (re)start the RAF loop if needed. */
      function enqueue(text: string) {
        pendingRef.current += text;
        if (!typingActiveRef.current) {
          typingActiveRef.current = true;
          rafIdRef.current = requestAnimationFrame(tick);
        }
      }

      /**
       * Cancel in-flight typing and immediately surface a final message.
       * Used on abort and fatal errors so the UI doesn't appear frozen.
       */
      function cancelTyping(finalText: string) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        typingActiveRef.current = false;
        pendingRef.current   = "";
        displayedRef.current = finalText;
        setMessages([
          ...baseMessagesRef.current,
          { role: "assistant", content: finalText },
        ]);
      }

      // ── SSE stream reader ────────────────────────────────────────────────────
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, model }),
          signal: controller.signal,
        });

        // Validation errors (400) return plain JSON before the SSE stream opens.
        if (!res.ok) {
          let errorMsg = `HTTP ${res.status}`;
          try {
            const errData = (await res.json()) as { error?: string };
            errorMsg = errData.error ?? errorMsg;
          } catch { /* ignore parse failures */ }
          throw new Error(errorMsg);
        }

        if (!res.body) throw new Error("No response body");

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are delimited by double newlines.
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const sseChunk of parts) {
            const dataLine = sseChunk.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            const event = JSON.parse(dataLine.slice(6)) as WorkflowEvent;

            switch (event.type) {
              case "message":
                // Non-claim response (greeting / help / unsupported)
                enqueue(event.summary);
                break;

              case "workflow-start":
                enqueue(`Assessment started for claim ${event.claimId}.\n`);
                break;

              case "step-start":
                enqueue(`\n## Step ${event.step}: ${event.stepName}\n`);
                break;

              case "step-result":
                // Tool calls surface immediately in ToolCallLog; the
                // human-readable line is typed out progressively.
                setToolCalls((prev) => [...prev, event.toolCall as ToolCallEntry]);
                enqueue(`${event.line}\n`);
                break;

              case "step-complete":
                // Content already visible from step-start + step-results.
                break;

              case "workflow-complete":
                enqueue(
                  `\n---\n\n## Final Assessment\n\n${event.recommendation}\n${event.reasoning}\n`
                );
                break;

              case "final-report":
                // Populate the right-panel report view immediately.
                setReport(event.report);
                break;

              case "error":
                enqueue(
                  `\n\nError: ${event.message}\n\nCheck that DEEPSEEK_API_KEY is set in .env.local.`
                );
                break;
            }
          }
        }

        // SSE stream closed normally.
        // Hand the "done" signal to the RAF loop via the captured `let` variable.
        sseComplete = true;
        // If the loop already drained the queue and stopped, end streaming now.
        if (!typingActiveRef.current && pendingRef.current.length === 0) {
          setIsStreaming(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          cancelTyping("Assessment cancelled.");
        } else {
          cancelTyping(
            "An error occurred. Please check that DEEPSEEK_API_KEY is set in .env.local and try again."
          );
        }
        setIsStreaming(false);
      } finally {
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
