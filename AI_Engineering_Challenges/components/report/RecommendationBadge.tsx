import type { Recommendation } from '@/types/report';

const CONFIG: Record<Recommendation, { label: string; classes: string; icon: string }> = {
  APPROVED: {
    label: 'APPROVED',
    classes: 'bg-green-50 text-green-700 border border-green-200',
    icon: '✓',
  },
  REJECTED: {
    label: 'REJECTED',
    classes: 'bg-red-50 text-red-700 border border-red-200',
    icon: '✗',
  },
  MORE_INFO_REQUIRED: {
    label: 'MORE INFO REQUIRED',
    classes: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    icon: '?',
  },
};

export default function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  const { label, classes, icon } = CONFIG[recommendation] ?? {
    label: recommendation,
    classes: 'bg-gray-50 text-gray-700 border border-gray-200',
    icon: '•',
  };

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${classes}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
