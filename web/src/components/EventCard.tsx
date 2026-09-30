import { useRouter } from 'next/navigation';
import { FossilClaim } from '@/lib/types';

interface EventCardProps {
  event: FossilClaim;
}

const CATEGORY_COLORS: Record<string, string> = {
  Science:    'bg-blue-50 text-blue-600 border-blue-100',
  Economics:  'bg-amber-50 text-amber-600 border-amber-100',
  Politics:   'bg-red-50 text-red-600 border-red-100',
  Society:    'bg-purple-50 text-purple-600 border-purple-100',
  Technology: 'bg-green-50 text-green-600 border-green-100',
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  VOTING:    { label: 'Voting',    className: 'bg-blue-50 text-blue-700 border-blue-100' },
  REVEALING: { label: 'Revealing', className: 'bg-amber-50 text-amber-700 border-amber-100' },
  RESOLVED:  { label: 'Resolved',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  VOIDED:    { label: 'Voided',    className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export function EventCard({ event }: EventCardProps) {
  const router = useRouter();
  const isResolved = event.status === 'RESOLVED' || event.status === 'VOIDED';
  const hasVotes = event.votesFor !== undefined && event.votesAgainst !== undefined;
  const totalVotes = hasVotes ? event.votesFor! + event.votesAgainst! : 0;
  const forPercentage = totalVotes > 0 ? (event.votesFor! / totalVotes) * 100 : 0;
  const catColor = CATEGORY_COLORS[event.category] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  const statusConfig = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.VOIDED;

  // Time remaining
  const now = Date.now();
  const activeDeadline = event.status === 'VOTING' ? event.commitEnd : event.status === 'REVEALING' ? event.revealEnd : null;
  let timeLabel = '';
  if (activeDeadline) {
    const msLeft = activeDeadline - now;
    if (msLeft > 0) {
      const h = Math.floor(msLeft / 3_600_000);
      const m = Math.floor((msLeft % 3_600_000) / 60_000);
      timeLabel = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    }
  }

  const handleCardClick = () => {
    router.push(`/event/${event.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-[var(--border)] p-5 shadow-[var(--shadow)] hover:shadow-[var(--shadow-hover)] hover:border-gray-300 transition-all cursor-pointer group"
    >
      {/* Top row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${catColor}`}>
          {event.category}
        </span>
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusConfig.className}`}>
          {statusConfig.label}{timeLabel ? ` · ${timeLabel}` : ''}
        </span>
        {event.outcome && event.outcome !== 'PENDING' && (
          <span className={`ml-auto px-2.5 py-0.5 text-xs font-bold rounded-full border ${
            event.outcome === 'ACCEPTED' ? 'bg-[var(--yes-bg)] text-[var(--yes)] border-[var(--yes-border)]' :
            event.outcome === 'REJECTED' ? 'bg-[var(--no-bg)] text-[var(--no)] border-[var(--no-border)]' :
            'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            {event.outcome === 'ACCEPTED' ? 'TRUE' : event.outcome === 'REJECTED' ? 'FALSE' : event.outcome}
          </span>
        )}
      </div>

      {/* Claim text */}
      <h3 className="text-base font-semibold text-[var(--foreground)] mb-3 leading-snug line-clamp-2 group-hover:text-[#1f2937] transition-colors">
        {event.description}
      </h3>

      {/* Vote bar — after resolution */}
      {isResolved && hasVotes && totalVotes > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--yes)] rounded-full transition-all"
              style={{ width: `${forPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--muted)] font-medium">
            <span className="text-[var(--yes)]">YES {event.votesFor} ({forPercentage.toFixed(0)}%)</span>
            <span className="text-[var(--no)]">NO {event.votesAgainst} ({(100 - forPercentage).toFixed(0)}%)</span>
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          {event.poolSui !== undefined && (
            <span className="text-xs text-[var(--muted)] font-medium">
              Pool: <span className="text-[var(--foreground)] font-semibold">{event.poolSui} SUI</span>
            </span>
          )}
          {!isResolved && event.commits > 0 && (
            <span className="text-xs text-[var(--muted)]">
              {event.commits} vote{event.commits > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {event.status === 'REVEALING' && (
          <span className="text-xs font-semibold text-amber-600">
            Reveal your vote →
          </span>
        )}
      </div>
    </div>
  );
}
