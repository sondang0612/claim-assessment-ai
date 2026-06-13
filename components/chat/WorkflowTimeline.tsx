'use client';

export interface WorkflowStepEntry {
  step: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export default function WorkflowTimeline({ steps }: { steps: WorkflowStepEntry[] }) {
  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5">
      <div className="flex items-center gap-1 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.step} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <div className="w-5 h-px bg-gray-200 mx-0.5" />}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  s.status === 'pending'
                    ? 'bg-gray-300'
                    : s.status === 'running'
                    ? 'bg-blue-400 animate-pulse'
                    : s.status === 'completed'
                    ? 'bg-green-400'
                    : 'bg-red-400'
                }`}
              />
              <span
                className={`text-[10px] font-medium whitespace-nowrap ${
                  s.status === 'pending'
                    ? 'text-gray-400'
                    : s.status === 'running'
                    ? 'text-blue-600'
                    : s.status === 'completed'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {s.stepName}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
