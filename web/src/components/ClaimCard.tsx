'use client';

import Link from 'next/link';
import { FossilClaim } from '@/lib/types';
import { CategoryBadge } from './CategoryBadge';
import { StatusBadge, OutcomeBadge } from './StatusBadge';
import { ProfileLink } from './ProfileLink';

interface ClaimCardProps {
  claim: FossilClaim;
}

function getTimeLabel(claim: FossilClaim): string | null {
  const now = Date.now();
  const deadline =
    claim.status === 'VOTING'    ? claim.commitEnd :
    claim.status === 'REVEALING' ? claim.revealEnd :
    null;

  if (!deadline) return null;
  const ms = deadline - now;
  if (ms <= 0) return null;

  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m left`;
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const isResolved = claim.status === 'RESOLVED' || claim.status === 'VOIDED';
  const isRevealing = claim.status === 'REVEALING';
  const timeLabel = getTimeLabel(claim);

  const hasVotes = claim.votesFor !== undefined && claim.votesAgainst !== undefined;
  const totalVotes = hasVotes ? claim.votesFor! + claim.votesAgainst! : 0;
  const forPct = totalVotes > 0 ? (claim.votesFor! / totalVotes) * 100 : 0;

  const borderAccent =
    claim.outcome === 'ACCEPTED' ? 'border-l-[3px] border-l-[var(--yes-light)]' :
    claim.outcome === 'REJECTED' ? 'border-l-[3px] border-l-[var(--no-light)]' :
    '';

  return (
    <Link
      href={`/event/${claim.id}`}
      className={`block bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-hover)] hover:border-[var(--border-strong)] transition-all duration-200 group ${isResolved ? borderAccent : ''}`}
    >
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <CategoryBadge category={claim.category} />
        <StatusBadge status={claim.status} />
        {claim.outcome && claim.outcome !== 'PENDING' && (
          <span className="ml-auto">
            <OutcomeBadge outcome={claim.outcome} />
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-[var(--foreground)] leading-snug line-clamp-2 mb-3 group-hover:opacity-80 transition-opacity">
        {claim.description}
      </h3>

      {/* Context — only active, non-revealing */}
      {claim.context && !isResolved && !isRevealing && (
        <p className="text-sm text-[var(--subtle)] line-clamp-1 mb-4 leading-relaxed">
          {claim.context}
        </p>
      )}

      {/* Time remaining — prominently during active phases */}
      {!isResolved && timeLabel && (
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold mb-4 ${isRevealing ? 'text-amber-600' : 'text-[var(--muted)]'}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0114 0z" />
          </svg>
          {isRevealing ? `Reveal window — ${timeLabel}` : timeLabel}
        </div>
      )}

      {/* Vote bar — resolved only */}
      {isResolved && hasVotes && totalVotes > 0 && (
        <div className="mb-4">
          <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${forPct}%`, background: 'var(--yes-light)' }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span style={{ color: 'var(--yes-light)' }}>YES {forPct.toFixed(0)}%</span>
            <span style={{ color: 'var(--no-light)' }}>NO {(100 - forPct).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <ProfileLink address={claim.proposer} />
        <div className="text-xs text-[var(--subtle)]">
          {isResolved && claim.resolvedAt ? (
            <span>
              {new Date(claim.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
