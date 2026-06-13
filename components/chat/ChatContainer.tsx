"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PartialAssessmentReport } from "@/types/report";
import type { WorkflowEvent } from "@/types/workflow";
import type { Conversation } from "@/types/conversation";
import type { ToolCallEntry } from "./ToolCallLog";
import type { WorkflowStepEntry } from "./WorkflowTimeline";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ToolCallLog from "./ToolCallLog";
import WorkflowTimeline from "./WorkflowTimeline";
import AssessmentReportView from "../report/AssessmentReport";
import Sidebar from "../sidebar/Sidebar";

// ── Types ────────────────────────────────────────────────────────────────────

type DeepSeekModel = "deepseek-chat" | "deepseek-reasoner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Characters revealed per animation frame (~60 fps → ~300 chars/sec). */
const CHARS_PER_FRAME = 5;

const STORAGE_KEY = "claim-assessment-conversations-v1";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

// ── Synchronized effect queue type ──────────────────────────────────────────

interface ScheduledEffect {
  /** Fire when displayedRef.current.length reaches this value. */
  fireAtPos: number;
  effect: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ChatContainer() {
  // ── Conversation history ─────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Active conversation's chat state ─────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepEntry[]>([]);
  const [report, setReport] = useState<PartialAssessmentReport | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<DeepSeekModel>("deepseek-chat");

  const abortRef = useRef<AbortController | null>(null);

  // ── Typing-queue refs ─────────────────────────────────────────────────────
  const pendingRef = useRef("");
  const displayedRef = useRef("");
  const baseMessagesRef = useRef<Message[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);

  // ── Synchronized side-effect queue ───────────────────────────────────────
  const scheduledEffectsRef = useRef<ScheduledEffect[]>([]);
  const totalEnqueuedRef = useRef(0);

  // ── Snapshot ref (latest state for saving without stale closures) ─────────
  // Updated after every render via a no-dep effect so the streaming-complete
  // effect always reads the final values without triggering extra re-runs.
  const snapshotRef = useRef({ messages, toolCalls, workflowSteps, report });
  const prevIsStreamingRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = { messages, toolCalls, workflowSteps, report };
  });

  // ── Persist conversations to localStorage ─────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      /* ignore quota errors */
    }
  }, [conversations]);

  // ── Save completed conversation state when streaming finishes ─────────────
  // Uses snapshotRef (updated after every render by the no-dep effect above)
  // so we always get the final state without adding volatile state to deps.
  useEffect(() => {
    const wasPrevStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    if (wasPrevStreaming && !isStreaming && activeConvId) {
      const { messages: msgs, toolCalls: tcs, workflowSteps: wfs, report: rpt } = snapshotRef.current;
      if (msgs.length > 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId
              ? {
                  ...c,
                  messages: msgs,
                  toolCalls: tcs,
                  workflowSteps: wfs,
                  report: rpt,
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );
      }
    }
  }, [isStreaming, activeConvId]);

  // ── Reset helpers shared by selectConversation and newAssessment ──────────
  function clearAnimation() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingRef.current = "";
    displayedRef.current = "";
    totalEnqueuedRef.current = 0;
    scheduledEffectsRef.current = [];
    typingActiveRef.current = false;
  }

  // ── Load a historical conversation ────────────────────────────────────────
  const selectConversation = useCallback(
    (id: string) => {
      if (isStreaming || id === activeConvId) return;
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;

      clearAnimation();
      setActiveConvId(id);
      setMessages(conv.messages as Message[]);
      setToolCalls(conv.toolCalls as ToolCallEntry[]);
      setWorkflowSteps(conv.workflowSteps as WorkflowStepEntry[]);
      setReport(conv.report);
    },
    [isStreaming, activeConvId, conversations]
  );

  // ── Start a fresh conversation ────────────────────────────────────────────
  const newAssessment = useCallback(() => {
    if (isStreaming) return;
    clearAnimation();
    setActiveConvId(null);
    setMessages([]);
    setToolCalls([]);
    setWorkflowSteps([]);
    setReport(null);
  }, [isStreaming]);

  // ── Delete a conversation ─────────────────────────────────────────────────
  const deleteConversation = useCallback(
    (id: string) => {
      if (id === activeConvId) newAssessment();
      setConversations((prev) => prev.filter((c) => c.id !== id));
    },
    [activeConvId, newAssessment]
  );

  // ── Rename a conversation ────────────────────────────────────────────────
  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  // ── sendMessage ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      // Create or reuse active conversation
      const convId = activeConvId ?? generateId();
      if (!activeConvId) {
        const title = content.length > 60 ? content.slice(0, 57) + "…" : content;
        const now = new Date().toISOString();
        setConversations((prev) => [
          { id: convId, title, messages: [], toolCalls: [], workflowSteps: [], report: null, createdAt: now, updatedAt: now },
          ...prev,
        ]);
        setActiveConvId(convId);
      }

      // ── Reset animation state ──────────────────────────────────────────
      clearAnimation();

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

      // ── RAF typing loop ──────────────────────────────────────────────────
      function tick() {
        if (pendingRef.current.length === 0) {
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

        const revealedPos = displayedRef.current.length;
        if (scheduledEffectsRef.current.length > 0) {
          const due = scheduledEffectsRef.current.filter(
            (e) => e.fireAtPos <= revealedPos
          );
          if (due.length > 0) {
            scheduledEffectsRef.current = scheduledEffectsRef.current.filter(
              (e) => e.fireAtPos > revealedPos
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

      function enqueue(text: string) {
        pendingRef.current += text;
        totalEnqueuedRef.current += text.length;
        if (!typingActiveRef.current) {
          typingActiveRef.current = true;
          rafIdRef.current = requestAnimationFrame(tick);
        }
      }

      function scheduleEffect(effect: () => void) {
        scheduledEffectsRef.current.push({
          fireAtPos: totalEnqueuedRef.current,
          effect,
        });
      }

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

      // ── SSE stream reader ────────────────────────────────────────────────
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
          } catch { /* ignore */ }
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
            const dataLine = sseChunk.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            const event = JSON.parse(dataLine.slice(6)) as WorkflowEvent;

            switch (event.type) {
              case "message":
                enqueue(event.summary);
                break;

              case "workflow-start":
                // Update conversation title with claim ID once we know it.
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? { ...c, title: `Claim ${event.claimId}`, updatedAt: new Date().toISOString() }
                      : c
                  )
                );
                enqueue(`Assessment started for claim ${event.claimId}.\n`);
                break;

              case "step-start":
                scheduleEffect(() => {
                  const { step, stepName } = event;
                  setWorkflowSteps((prev) => {
                    if (prev.some((s) => s.step === step)) {
                      return prev.map((s) =>
                        s.step === step ? { ...s, status: "running" } : s
                      );
                    }
                    return [...prev, { step, stepName, status: "running" }];
                  });
                });
                enqueue(`\n## Step ${event.step}: ${event.stepName}\n`);
                break;

              case "tool-start":
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
                enqueue(`${event.line}\n`);
                scheduleEffect(() => {
                  setToolCalls((prev) =>
                    prev.map((tc) =>
                      tc.toolCallId === event.toolCall.toolCallId
                        ? { ...tc, output: event.toolCall.output, status: "completed" }
                        : tc
                    )
                  );
                });
                break;

              case "step-result":
                // Handled by tool-start / tool-complete — no-op here.
                break;

              case "step-complete":
                scheduleEffect(() => {
                  setWorkflowSteps((prev) =>
                    prev.map((s) =>
                      s.step === event.step ? { ...s, status: "completed" } : s
                    )
                  );
                });
                break;

              case "report-update":
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
                  `\n---\n\n## Final Assessment\n\n${event.recommendation}\n${event.reasoning}\n`
                );
                break;

              case "final-report":
                scheduleEffect(() =>
                  setReport(event.report as PartialAssessmentReport)
                );
                break;

              case "error":
                enqueue(
                  `\n\nError: ${event.message}\n\nCheck that DEEPSEEK_API_KEY is set in .env.local.`
                );
                break;
            }
          }
        }

        sseComplete = true;
        if (!typingActiveRef.current && pendingRef.current.length === 0) {
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
            "An error occurred. Please check that DEEPSEEK_API_KEY is set in .env.local and try again."
          );
        }
        setIsStreaming(false);
      } finally {
        abortRef.current = null;
      }
    },
    [messages, model, isStreaming, activeConvId]
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Desktop sidebar (participates in flex flow, collapses to 0 width) ── */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out hidden md:block ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
      >
        {/* Inner div keeps the sidebar at its natural width so content doesn't reflow. */}
        <div className="w-64 h-full">
          <Sidebar
            conversations={conversations}
            activeId={activeConvId}
            isStreaming={isStreaming}
            onSelect={(id) => {
              selectConversation(id);
              // Close sidebar on small desktops after selecting
            }}
            onNew={newAssessment}
            onRename={renameConversation}
            onDelete={deleteConversation}
          />
        </div>
      </div>

      {/* ── Mobile drawer (fixed overlay) ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeConvId}
          isStreaming={isStreaming}
          onSelect={(id) => {
            selectConversation(id);
            setSidebarOpen(false);
          }}
          onNew={() => {
            newAssessment();
            setSidebarOpen(false);
          }}
          onRename={renameConversation}
          onDelete={deleteConversation}
        />
      </div>

      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* ── Chat panel ── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200 bg-white">
          {/* Header */}
          <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
            {/* Sidebar toggle */}
            <button
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Title / active conversation */}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">
                {activeConvId
                  ? (conversations.find((c) => c.id === activeConvId)?.title ?? "Assessment")
                  : "Claim Assessment AI"}
              </h1>
            </div>

            {/* Streaming indicator */}
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-blue-500 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Assessing…
              </span>
            )}
          </header>

          {/* Messages */}
          <MessageList messages={messages} isStreaming={isStreaming} />

          {/* Workflow step timeline */}
          {workflowSteps.length > 0 && <WorkflowTimeline steps={workflowSteps} />}

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

        {/* ── Report panel — persists across conversation switches ── */}
        <div className="w-80 xl:w-[420px] flex flex-col bg-gray-50 overflow-y-auto flex-shrink-0 border-l border-gray-100">
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
    </div>
  );
}
