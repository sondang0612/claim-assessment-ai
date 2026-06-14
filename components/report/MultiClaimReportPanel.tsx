"use client";

import { useState } from "react";
import type { ClaimEvent } from "@/types/report";
import AssessmentReportView from "./AssessmentReport";

interface MultiClaimReportPanelProps {
  claimEvents: ClaimEvent[];
  activeEventId: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; classes: string; icon: string }
> = {
  APPROVED: {
    label: "Approved",
    classes: "bg-green-100 text-green-700",
    icon: "✓",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-100 text-red-700",
    icon: "✗",
  },
  MORE_INFO_REQUIRED: {
    label: "More Info",
    classes: "bg-yellow-100 text-yellow-700",
    icon: "?",
  },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-600",
    icon: "•",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.classes}`}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function MultiClaimReportPanel({
  claimEvents,
  activeEventId,
}: MultiClaimReportPanelProps) {
  // Default to most-recent event; key prop in parent resets this on each streaming cycle
  const [manualExpandedId, setManualExpandedId] = useState<string | null>(
    claimEvents[claimEvents.length - 1]?.eventId ?? null,
  );

  // Active event is always expanded during streaming; otherwise user's choice
  const expandedId = activeEventId ?? manualExpandedId;

  function handleToggle(eventId: string) {
    if (eventId === activeEventId) return; // live event stays open
    setManualExpandedId((prev) => (prev === eventId ? null : eventId));
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Claim History (chronological event log) ────────────────────── */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Claim History ({claimEvents.length})
        </h3>
        {/* <div className="space-y-1.5">
          {claimEvents.map((ev) => {
            const isActive = ev.eventId === activeEventId;
            return (
              <div key={ev.eventId} className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-gray-400 font-mono tabular-nums flex-shrink-0">
                  {formatTime(ev.timestamp)}
                </span>
                <span className="font-mono text-xs font-medium text-gray-700 flex-shrink-0">
                  {ev.claimId}
                </span>
                <span className="text-gray-300 flex-shrink-0">→</span>
                {ev.report.recommendation ? (
                  <StatusChip status={ev.report.recommendation} />
                ) : isActive ? (
                  <span className="text-xs text-gray-400 italic animate-pulse">
                    Assessing…
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>
            );
          })}
        </div> */}
      </div>

      {/* ── Individual event cards (newest first, collapsible) ─────────── */}
      <div className="space-y-2">
        {[...claimEvents].reverse().map((ev) => {
          const isExpanded = expandedId === ev.eventId;
          const isActive = ev.eventId === activeEventId;

          return (
            <div
              key={ev.eventId}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => handleToggle(ev.eventId)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm font-semibold text-gray-800 flex-shrink-0">
                    {ev.claimId}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono tabular-nums flex-shrink-0">
                    {formatTime(ev.timestamp)}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ev.report.recommendation ? (
                    <StatusChip status={ev.report.recommendation} />
                  ) : isActive ? (
                    <span className="text-xs text-gray-400 italic animate-pulse">
                      Assessing…
                    </span>
                  ) : null}
                  <span className="text-gray-400 text-xs">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100">
                  <AssessmentReportView report={ev.report} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
