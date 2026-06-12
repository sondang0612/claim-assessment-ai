'use client';

import { useState } from 'react';

interface ReportSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function ReportSection({ title, icon, children, defaultOpen = true }: ReportSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 py-3 text-sm text-gray-600 space-y-1.5">{children}</div>}
    </div>
  );
}
