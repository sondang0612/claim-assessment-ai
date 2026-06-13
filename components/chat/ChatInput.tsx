"use client";

import { useState, useRef, type KeyboardEvent } from "react";

type DeepSeekModel = "deepseek-chat" | "deepseek-reasoner";

const SCENARIOS = [
  {
    label: "✓ Approval (CLM-001)",
    color: "green" as const,
    message:
      "Please assess claim CLM-001 for John Doe. Policy: POL-001. Claim type: surgery. Diagnosis: appendicitis (K37). Procedures: CPT 44970 (laparoscopic appendectomy). Requested amount: $5,000. Documents to verify: DOC-001 (discharge summary), DOC-002 (itemized bill).",
  },
  {
    label: "✗ Rejection (CLM-002)",
    color: "red" as const,
    message:
      "Please assess claim CLM-002 for Jane Smith. Policy: POL-002. Claim type: elective. Diagnosis: elective cosmetic surgery (Z41.1). Procedures: CPT 15829 (rhytidectomy). Requested amount: $8,000. Documents to verify: DOC-004 (medical bill), DOC-005 (referral).",
  },
  {
    label: "? More Info (CLM-003)",
    color: "yellow" as const,
    message:
      "Please assess claim CLM-003 for Bob Johnson. Policy: POL-003. Claim type: surgery. Diagnosis: femoral fracture (S72.001A). Procedures: CPT 27244 (ORIF femur). Requested amount: $12,000. Documents to verify: DOC-006 (discharge summary), DOC-003 (itemized bill).",
  },
];

const SCENARIO_CLASSES = {
  green:
    "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200",
  red: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200",
  yellow:
    "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200",
};

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  model: DeepSeekModel;
  onModelChange: (model: DeepSeekModel) => void;
  onAbort: () => void;
}

export default function ChatInput({
  onSend,
  isStreaming,
  model,
  onModelChange,
  onAbort,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 space-y-2">
      {/* Quick scenario buttons */}
      <div className="flex gap-2 flex-wrap">
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSend(s.message)}
            disabled={isStreaming}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${SCENARIO_CLASSES[s.color]}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* <select
          value={model}
          onChange={(e) => onModelChange(e.target.value as DeepSeekModel)}
          disabled={isStreaming}
          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 flex-shrink-0"
        >
          <option value="deepseek-chat">deepseek-chat</option>
          <option value="deepseek-reasoner">deepseek-reasoner</option>
        </select> */}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          placeholder="Describe the claim… (Enter to send, Shift+Enter for newline)"
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 max-h-40"
        />

        {isStreaming ? (
          <button
            onClick={onAbort}
            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors border border-red-200 flex-shrink-0"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
