'use client';

import { useState } from 'react';

export interface ToolCallEntry {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: 'running' | 'calling' | 'completed' | 'done' | 'failed' | 'error';
}

const TOOL_META: Record<string, { icon: string; label: string }> = {
  verifyDocument:       { icon: '📄', label: 'Verify Document' },
  lookupPolicy:         { icon: '📋', label: 'Lookup Policy' },
  checkMedicalNecessity:{ icon: '🏥', label: 'Medical Necessity' },
  calculateBenefit:     { icon: '💰', label: 'Calculate Benefit' },
};

export default function ToolCallLog({ toolCalls }: { toolCalls: ToolCallEntry[] }) {
  const [open, setOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const meta = (name: string) => TOOL_META[name] ?? { icon: '🔧', label: name };

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          Tool Calls
          <span className="bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
            {toolCalls.length}
          </span>
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
          {toolCalls.map((call) => (
            <div key={call.toolCallId} className="rounded-lg bg-white border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                onClick={() => toggle(call.toolCallId)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span>{meta(call.toolName).icon}</span>
                  <span className="font-medium text-gray-700 flex-shrink-0">{meta(call.toolName).label}</span>
                  <span className="text-gray-400 font-mono text-[10px] truncate">
                    {Object.entries(call.input)
                      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
                      .join(' ')}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      call.status === 'running' || call.status === 'calling'
                        ? 'bg-yellow-400 animate-pulse'
                        : call.status === 'completed' || call.status === 'done'
                        ? 'bg-green-400'
                        : 'bg-red-400'
                    }`}
                  />
                  <span className="text-gray-400">{expandedIds.has(call.toolCallId) ? '▲' : '▼'}</span>
                </span>
              </button>

              {expandedIds.has(call.toolCallId) && call.output !== undefined && (
                <div className="px-3 pb-2 border-t border-gray-100">
                  <p className="text-[10px] font-medium text-gray-400 mt-1.5 mb-1">Result</p>
                  <pre className="text-[10px] text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(call.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
