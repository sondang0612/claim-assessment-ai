"use client";

import { useState, useRef, useCallback } from "react";
import type { PartialAssessmentReport } from "@/types/report";
import type { WorkflowEvent } from "@/types/workflow";
import type { ToolCallEntry } from "./ToolCallLog";
import type { WorkflowStepEntry } from "./WorkflowTimeline";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ToolCallLog from "./ToolCallLog";
import WorkflowTimeline from "./WorkflowTimeline";
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

/** Pairs a side-effect callback with the display-position at which it should fire. */
interface ScheduledEffect {
  /** Fire when displayedRef.current.length reaches this value. */
  fireAtPos: number;
  effect: () => void;
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepEntry[]>([]);
  const [report, setReport] = useState<PartialAssessmentReport | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<DeepSeekModel>("deepseek-chat");

  const abortRef = useRef<AbortController | null>(null);

  // ── Typing-queue refs ────────────────────────────────────────────────────────
  const pendingRef = useRef(""); // chars waiting to be revealed
  const displayedRef = useRef(""); // all chars revealed so far (cumulative)
  const baseMessagesRef = useRef<Message[]>([]); // history snapshot without assistant slot
  const rafIdRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);

  // ── Synchronized side-effect queue ─────────────────────────────────────────
  // Effects (setToolCalls, setWorkflowSteps, setReport) are scheduled to fire
  // when displayedRef.length reaches a specific character position, keeping
  // the UI panels in sync with the typing animation instead of network speed.
  const scheduledEffectsRef = useRef<ScheduledEffect[]>([]);
  const totalEnqueuedRef = useRef(0); // cumulative chars ever pushed to pendingRef

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      // ── Reset all state from previous turn ──────────────────────────────────
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingRef.current = "";
      displayedRef.current = "";
      totalEnqueuedRef.current = 0;
      scheduledEffectsRef.current = [];
      typingActiveRef.current = false;

      const userMsg: Message = { role: "user", content };
      const nextMessages = [...messages, userMsg];
      baseMessagesRef.current = nextMessages;

      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      setToolCalls([]);
      setWorkflowSteps([]);
      setReport(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let sseComplete = false;

      // ── RAF typing loop ──────────────────────────────────────────────────────
      function tick() {
        if (pendingRef.current.length === 0) {
          // Queue drained — fire any effects that are still pending (safety net
          // for effects scheduled after the last enqueue call).
          if (scheduledEffectsRef.current.length > 0) {
            const remaining = scheduledEffectsRef.current;
            scheduledEffectsRef.current = [];
            for (const e of remaining) e.effect();
          }
          typingActiveRef.current = false;
          rafIdRef.current = null;
          if (sseComplete) setIsStreaming(false);
          return;
        }

        const chunk = pendingRef.current.slice(0, CHARS_PER_FRAME);
        pendingRef.current = pendingRef.current.slice(CHARS_PER_FRAME);
        displayedRef.current += chunk;

        // Fire every effect whose fireAtPos has now been reached.
        const revealedPos = displayedRef.current.length;
        if (scheduledEffectsRef.current.length > 0) {
          const due = scheduledEffectsRef.current.filter(
            (e) => e.fireAtPos <= revealedPos,
          );
          if (due.length > 0) {
            scheduledEffectsRef.current = scheduledEffectsRef.current.filter(
              (e) => e.fireAtPos > revealedPos,
            );
            for (const e of due) e.effect();
          }
        }

        setMessages([
          ...baseMessagesRef.current,
          { role: "assistant", content: displayedRef.current },
        ]);

        rafIdRef.current = requestAnimationFrame(tick);
      }

      /** Push text onto the typing queue and start the RAF loop if idle. */
      function enqueue(text: string) {
        pendingRef.current += text;
        totalEnqueuedRef.current += text.length;
        if (!typingActiveRef.current) {
          typingActiveRef.current = true;
          rafIdRef.current = requestAnimationFrame(tick);
        }
      }

      /**
       * Register a side effect to fire when the text enqueued SO FAR has been
       * fully revealed.  Call BEFORE enqueue() to fire before new text starts
       * typing; call AFTER to fire once that text finishes.
       */
      function scheduleEffect(effect: () => void) {
        scheduledEffectsRef.current.push({
          fireAtPos: totalEnqueuedRef.current,
          effect,
        });
      }

      /** Cancel in-flight animation and surface a final message immediately. */
      function cancelTyping(finalText: string) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        typingActiveRef.current = false;
        pendingRef.current = "";
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

        if (!res.ok) {
          let errorMsg = `HTTP ${res.status}`;
          try {
            const errData = (await res.json()) as { error?: string };
            errorMsg = errData.error ?? errorMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errorMsg);
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const sseChunk of parts) {
            const dataLine = sseChunk
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            const event = JSON.parse(dataLine.slice(6)) as WorkflowEvent;

            switch (event.type) {
              case "message":
                enqueue(event.summary);
                break;

              case "workflow-start":
                enqueue(`Assessment started for claim ${event.claimId}.\n`);
                break;

              case "step-start":
                // Mark this step RUNNING before its header text begins typing,
                // so the timeline updates the moment the previous step's text clears.
                scheduleEffect(() => {
                  const { step, stepName } = event;
                  setWorkflowSteps((prev) => {
                    const exists = prev.some((s) => s.step === step);
                    if (exists) {
                      return prev.map((s) =>
                        s.step === step ? { ...s, status: "running" } : s,
                      );
                    }
                    return [...prev, { step, stepName, status: "running" }];
                  });
                });
                enqueue(`\n## Step ${event.step}: ${event.stepName}\n`);
                break;

              case "tool-start":
                // Add tool as RUNNING once the step header finishes typing.
                scheduleEffect(() => {
                  const entry: ToolCallEntry = {
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    input: event.input,
                    status: "running",
                  };
                  setToolCalls((prev) => [...prev, entry]);
                });
                break;

              case "tool-complete":
                // Enqueue the result line first, then mark the tool DONE once typed.
                enqueue(`${event.line}\n`);
                scheduleEffect(() => {
                  setToolCalls((prev) =>
                    prev.map((tc) =>
                      tc.toolCallId === event.toolCall.toolCallId
                        ? {
                            ...tc,
                            output: event.toolCall.output,
                            status: "completed",
                          }
                        : tc,
                    ),
                  );
                });
                break;

              case "step-result":
                // Intentionally ignored — tool-start / tool-complete handle the log.
                break;

              case "step-complete":
                // Mark the step DONE after its last tool result finishes typing.
                scheduleEffect(() => {
                  setWorkflowSteps((prev) =>
                    prev.map((s) =>
                      s.step === event.step ? { ...s, status: "completed" } : s,
                    ),
                  );
                });
                break;

              case "report-update":
                // Merge the partial report snapshot into state, timed to when
                // the step's narration text finishes typing.
                scheduleEffect(() => {
                  setReport((prev) => {
                    if (!prev) return event.partial;
                    return {
                      ...prev,
                      ...event.partial,
                      sections: { ...prev.sections, ...event.partial.sections },
                    };
                  });
                });
                break;

              case "workflow-complete":
                enqueue(
                  `\n---\n\n## Final Assessment\n\n${event.recommendation}\n${event.reasoning}\n`,
                );
                break;

              case "final-report":
                // Arrives after all text has been enqueued; set the complete report
                // once the final assessment text finishes typing.
                scheduleEffect(() =>
                  setReport(event.report as PartialAssessmentReport),
                );
                break;

              case "error":
                enqueue(
                  `\n\nError: ${event.message}\n\nCheck that DEEPSEEK_API_KEY is set in .env.local.`,
                );
                break;
            }
          }
        }

        sseComplete = true;
        // If the RAF loop already drained and stopped before SSE closed, end streaming.
        if (!typingActiveRef.current && pendingRef.current.length === 0) {
          // Flush any remaining scheduled effects before clearing the spinner.
          if (scheduledEffectsRef.current.length > 0) {
            const remaining = scheduledEffectsRef.current;
            scheduledEffectsRef.current = [];
            for (const e of remaining) e.effect();
          }
          setIsStreaming(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          cancelTyping("Assessment cancelled.");
        } else {
          cancelTyping(
            "An error occurred. Please check that DEEPSEEK_API_KEY is set in .env.local and try again.",
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

        {/* Workflow step timeline — appears once steps start */}
        {/* {workflowSteps.length > 0 && (
          <WorkflowTimeline steps={workflowSteps} />
        )} */}

        {/* Tool call log — appears once the first tool fires */}
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
