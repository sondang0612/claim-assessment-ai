"use client";

import { useState, useEffect, useCallback, memo } from "react";
import type { ClaimEvent } from "@/types/report";
import AssessmentReportView from "./AssessmentReport";

interface MultiClaimReportPanelProps {
  claimEvents: ClaimEvent[];
  activeEventId: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Memoized history row ──────────────────────────────────────────────────────
// Only re-renders when its own props change — opening the modal doesn't cascade
// through the entire list, only the two rows whose isSelected changed.

interface HistoryRowProps {
  ev: ClaimEvent;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (eventId: string) => void;
}

const HistoryRow = memo(function HistoryRow({
  ev,
  isSelected,
  isActive,
  onSelect,
}: HistoryRowProps) {
  return (
    <button
      onClick={() => onSelect(ev.eventId)}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        isSelected
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-semibold text-gray-800 flex-shrink-0">
            {ev.claimId}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-[10px] text-gray-400 font-mono tabular-nums">
            {formatTime(ev.timestamp)}
          </span>
        </div>
        <div className="flex-shrink-0">
          {ev.report.recommendation ? (
            <StatusChip status={ev.report.recommendation} />
          ) : isActive ? (
            <span className="text-xs text-gray-400 italic animate-pulse">
              Assessing…
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
});

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function MultiClaimReportPanel({
  claimEvents,
  activeEventId,
}: MultiClaimReportPanelProps) {
  // parent key={streamingEventId ?? 'idle'} remounts this component on streaming
  // start/end, so useState(activeEventId) auto-opens the modal for the live event
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    activeEventId,
  );

  const selectedIndex = selectedEventId
    ? claimEvents.findIndex((ev) => ev.eventId === selectedEventId)
    : -1;
  const selectedEvent = selectedIndex >= 0 ? claimEvents[selectedIndex] : null;

  const canGoPrev = selectedIndex > 0;
  const canGoNext =
    selectedIndex >= 0 && selectedIndex < claimEvents.length - 1;

  // Stable callback — passed to every memoized HistoryRow
  const handleSelect = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  function closeModal() {
    setSelectedEventId(null);
  }

  function goToPrev() {
    if (canGoPrev) setSelectedEventId(claimEvents[selectedIndex - 1].eventId);
  }

  function goToNext() {
    if (canGoNext) setSelectedEventId(claimEvents[selectedIndex + 1].eventId);
  }

  // Close modal on ESC (setState inside event callback — not in effect body)
  useEffect(() => {
    if (!selectedEventId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedEventId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEventId]);

  return (
    <>
      {/* ── History navigation panel ─────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Claim History
          </h3>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {claimEvents.length}
          </span>
        </div>

        <div className="space-y-1">
          {[...claimEvents].reverse().map((ev) => (
            <HistoryRow
              key={ev.eventId}
              ev={ev}
              isSelected={ev.eventId === selectedEventId}
              isActive={ev.eventId === activeEventId}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {!selectedEventId && (
          <p className="mt-4 text-xs text-gray-400 text-center italic">
            Click a claim to view the full report
          </p>
        )}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Assessment report for ${selectedEvent.claimId}`}
        >
          {/* Backdrop — click to close */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              {/* Claim identity */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-bold text-gray-900 text-sm flex-shrink-0">
                  {selectedEvent.claimId}
                </span>
                <span className="text-xs text-gray-400 font-mono tabular-nums flex-shrink-0">
                  {formatTime(selectedEvent.timestamp)}
                </span>
                {selectedEvent.eventId === activeEventId && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>

              {/* Navigation + close */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={goToPrev}
                  disabled={!canGoPrev}
                  aria-label="View older claim"
                  title="Older"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <span className="text-xs text-gray-400 font-mono tabular-nums px-1 min-w-[40px] text-center">
                  {selectedIndex + 1}/{claimEvents.length}
                </span>

                <button
                  onClick={goToNext}
                  disabled={!canGoNext}
                  aria-label="View newer claim"
                  title="Newer"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                <div className="w-px h-4 bg-gray-200 mx-1.5" />

                <button
                  onClick={closeModal}
                  aria-label="Close report (Esc)"
                  title="Close (Esc)"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable report content */}
            <div className="overflow-y-auto flex-1">
              <AssessmentReportView report={selectedEvent.report} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
