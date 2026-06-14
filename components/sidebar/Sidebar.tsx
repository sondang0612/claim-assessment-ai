"use client";

import { useState, useRef, useEffect } from "react";
import type { Conversation } from "@/types/conversation";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGroups(convs: Conversation[], query: string) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? convs.filter((c) => c.title.toLowerCase().includes(q))
    : convs;
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const now = new Date();
  const todayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const ystMs = todayMs - 86_400_000;
  const weekMs = todayMs - 7 * 86_400_000;

  const bucket = (c: Conversation) => new Date(c.updatedAt).getTime();

  return {
    today: sorted.filter((c) => bucket(c) >= todayMs),
    yesterday: sorted.filter((c) => bucket(c) >= ystMs && bucket(c) < todayMs),
    previous7Days: sorted.filter(
      (c) => bucket(c) >= weekMs && bucket(c) < ystMs,
    ),
    older: sorted.filter((c) => bucket(c) < weekMs),
  };
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  if (d.getTime() >= todayMs) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── ConversationItem ──────────────────────────────────────────────────────────

interface ItemProps {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

function ConversationItem({
  conv,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commitRename() {
    const t = draft.trim();
    if (t && t !== conv.title) onRename(t);
    else setDraft(conv.title);
    setEditing(false);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors outline-none ${
        isActive
          ? "bg-white/10 text-white"
          : "text-gray-400 hover:bg-white/5 hover:text-gray-200 focus-visible:bg-white/5"
      }`}
      onClick={() => {
        if (!editing) onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !editing) onSelect();
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 bg-gray-700 text-white text-sm rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            }
            if (e.key === "Escape") {
              setDraft(conv.title);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate leading-snug">{conv.title}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {fmtTime(conv.updatedAt)}
          </p>
        </div>
      )}

      {/* Hover / active action buttons */}
      {!editing && (
        <div
          className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Rename"
            title="Rename"
            className="p-1 rounded hover:bg-gray-600 text-gray-500 hover:text-gray-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setDraft(conv.title);
              setEditing(true);
            }}
          >
            {/* pencil */}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            aria-label="Delete"
            title="Delete"
            className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            {/* trash */}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Group heading ─────────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider select-none">
      {label}
    </p>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  conversations,
  activeId,
  isStreaming,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const groups = getGroups(conversations, search);
  const totalVisible =
    groups.today.length +
    groups.yesterday.length +
    groups.previous7Days.length +
    groups.older.length;

  return (
    <div className="flex flex-col h-full bg-gray-900 select-none">
      {/* ── Brand + New button ── */}
      <div className="flex-shrink-0 px-3 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 12h6M12 9v6" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white leading-none">
            Claims Assessment AI
          </span>
        </div>

        <button
          disabled={isStreaming}
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 hover:text-white text-sm font-medium transition-colors border border-white/8"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Assessment
        </button>
      </div>

      {/* ── Search ── */}
      <div className="flex-shrink-0 px-3 pb-2 border-b border-white/5">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 text-sm text-gray-300 placeholder-gray-600 rounded-lg py-1.5 pl-7 pr-3 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-shadow"
          />
          {search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
              onClick={() => setSearch("")}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Conversation list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {conversations.length === 0 ? (
          /* Empty state — no conversations yet */
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-600"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-gray-600 font-medium">
              No conversations yet
            </p>
            <p className="text-[10px] text-gray-700 mt-1 leading-relaxed">
              Start a new assessment
              <br />
              to see history here.
            </p>
          </div>
        ) : totalVisible === 0 ? (
          /* Search returned nothing */
          <div className="py-10 text-center">
            <p className="text-xs text-gray-600">
              No results for &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          <>
            {groups.today.length > 0 && (
              <div>
                <GroupLabel label="Today" />
                {groups.today.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeId}
                    onSelect={() => onSelect(c.id)}
                    onRename={(title) => onRename(c.id, title)}
                    onDelete={() => onDelete(c.id)}
                  />
                ))}
              </div>
            )}
            {groups.yesterday.length > 0 && (
              <div>
                <GroupLabel label="Yesterday" />
                {groups.yesterday.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeId}
                    onSelect={() => onSelect(c.id)}
                    onRename={(title) => onRename(c.id, title)}
                    onDelete={() => onDelete(c.id)}
                  />
                ))}
              </div>
            )}
            {groups.previous7Days.length > 0 && (
              <div>
                <GroupLabel label="Previous 7 Days" />
                {groups.previous7Days.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeId}
                    onSelect={() => onSelect(c.id)}
                    onRename={(title) => onRename(c.id, title)}
                    onDelete={() => onDelete(c.id)}
                  />
                ))}
              </div>
            )}
            {groups.older.length > 0 && (
              <div>
                <GroupLabel label="Older" />
                {groups.older.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeId}
                    onSelect={() => onSelect(c.id)}
                    onRename={(title) => onRename(c.id, title)}
                    onDelete={() => onDelete(c.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
