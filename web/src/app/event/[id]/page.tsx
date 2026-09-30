'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchEvent } from '@/lib/sui';
import { FossilClaim } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { CommitForm } from '@/components/CommitForm';
import { RevealForm } from '@/components/RevealForm';
import { CountdownTimer } from '@/components/CountdownTimer';
import { ResolveButton } from '@/components/ResolveButton';
import { ClaimRewardButton } from '@/components/ClaimRewardButton';
import { CategoryBadge } from '@/components/CategoryBadge';
import { StatusBadge, OutcomeBadge } from '@/components/StatusBadge';
import { ProfileLink } from '@/components/ProfileLink';
import { useWallet } from '@/contexts/WalletContext';
import { Footer } from '@/components/Footer';

export default function ClaimDetailPage() {
  const { connected, address } = useWallet();
  const params = useParams();
  const eventId = params.id as string;
  const [claim, setClaim] = useState<FossilClaim | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingReveal, setHasPendingReveal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const parsed = await fetchEvent(eventId);
        setClaim(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load claim');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [eventId]);

  useEffect(() => {
    if (!address || !claim) return;
    const stored = localStorage.getItem(`fossil_commit_${eventId}_${address}`);
    const now = Date.now();
    const isRevealPhase = claim.commitEnd && claim.revealEnd && now >= claim.commitEnd && now < claim.revealEnd;
    setHasPendingReveal(!!stored && !!isRevealPhase);
  }, [address, claim, eventId]);

  useEffect(() => {
    if (!claim || claim.status === 'RESOLVED' || claim.status === 'VOIDED') return;
    const interval = setInterval(async () => {
      try {
        const parsed = await fetchEvent(eventId);
        setClaim(parsed);
      } catch { /* silent */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [claim, eventId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
            <p className="text-xs text-[var(--subtle)] font-medium uppercase tracking-widest">Loading</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-[var(--muted)] mb-6">{error || 'Claim not found'}</p>
            <Link href="/" className="btn-secondary">← Back to claims</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const now = Date.now();
  const isVotingPhase   = claim.commitEnd && now < claim.commitEnd;
  const isRevealPhase   = claim.commitEnd && claim.revealEnd && now >= claim.commitEnd && now < claim.revealEnd;
  const needsResolve    = claim.revealEnd && now >= claim.revealEnd && claim.status !== 'RESOLVED' && claim.status !== 'VOIDED';
  const isResolved      = claim.status === 'RESOLVED';
  const isVoided        = claim.status === 'VOIDED';

  const hasVotes = claim.votesFor !== undefined && claim.votesAgainst !== undefined;
  const totalVotes = hasVotes ? claim.votesFor! + claim.votesAgainst! : 0;
  const forPercent    = totalVotes > 0 ? (claim.votesFor! / totalVotes * 100) : 0;
  const againstPercent = totalVotes > 0 ? (claim.votesAgainst! / totalVotes * 100) : 0;

  const savedCommit = address ? (() => {
    try {
      const raw = localStorage.getItem(`fossil_commit_${eventId}_${address}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })() : null;

  const userWon = isResolved && savedCommit && claim.outcome !== 'TIED' && claim.outcome !== 'PENDING' &&
    ((savedCommit.vote === true  && claim.outcome === 'ACCEPTED') ||
     (savedCommit.vote === false && claim.outcome === 'REJECTED'));

  // Phase-based background
  const pageBg =
    isRevealPhase || hasPendingReveal ? 'bg-[var(--phase-reveal-bg)]' :
    isResolved || isVoided            ? 'bg-[var(--phase-archive-bg)]' :
    'bg-[var(--background)]';

  return (
    <div className={`min-h-screen ${pageBg} transition-colors duration-500 flex flex-col`}>
      <SiteHeader />

      {/* Reveal pending banner */}
      {hasPendingReveal && (
        <div className="bg-amber-500 text-white text-xs font-semibold text-center py-3 px-6 tracking-wide uppercase">
          Reveal window open — confirm your vote below to collect your reward
        </div>
      )}

      {/* Revealing phase banner */}
      {claim.status === 'REVEALING' && !hasPendingReveal && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-medium text-center py-2.5 px-6">
          This claim is in the reveal phase — scroll down to confirm your vote.
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 lg:px-8 py-12">

        {/* Back */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors uppercase tracking-widest font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Claims
          </Link>
        </div>

        {/* Claim card */}
        <div className={`bg-[var(--surface)] rounded-[var(--radius)] border p-8 md:p-10 mb-6 shadow-[var(--shadow-sm)] ${
          isResolved && claim.outcome === 'ACCEPTED' ? 'border-[var(--border)] border-l-4 border-l-[var(--yes-light)]' :
          isResolved && claim.outcome === 'REJECTED' ? 'border-[var(--border)] border-l-4 border-l-[var(--no-light)]' :
          isRevealPhase ? 'border-amber-200' :
          'border-[var(--border)]'
        }`}>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <CategoryBadge category={claim.category} />
            <StatusBadge status={claim.status} />
            {claim.resolvedAt && (
              <span className="text-xs text-[var(--subtle)] font-medium ml-1">
                {new Date(claim.resolvedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {claim.outcome && claim.outcome !== 'PENDING' && (
              <span className="ml-auto">
                <OutcomeBadge outcome={claim.outcome} />
              </span>
            )}
          </div>

          {/* Claim statement */}
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] leading-snug mb-6 tracking-tight">
            {claim.description}
          </h1>

          {/* Context — styled as document excerpt */}
          {claim.context && (
            <div className="mb-8 pl-5 border-l-2 border-[var(--border)]">
              <p className="text-[11px] text-[var(--subtle)] font-semibold uppercase tracking-wider mb-2">Context</p>
              <p className="text-sm text-[var(--muted)] leading-relaxed italic">{claim.context}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className={`grid gap-6 pt-6 border-t border-[var(--border)] ${isVotingPhase ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
            <div>
              <p className="text-[10px] text-[var(--subtle)] mb-1.5 font-semibold uppercase tracking-wider">Creator</p>
              <ProfileLink address={claim.proposer} label="" className="text-xs" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--subtle)] mb-1.5 font-semibold uppercase tracking-wider">Stake</p>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {(claim.stakeAmount / 1_000_000_000).toFixed(2)} SUI
              </p>
            </div>
            {!isVotingPhase && (
              <>
                <div>
                  <p className="text-[10px] text-[var(--subtle)] mb-1.5 font-semibold uppercase tracking-wider">Pool</p>
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {claim.poolSui.toFixed ? claim.poolSui.toFixed(2) : claim.poolSui} SUI
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--subtle)] mb-1.5 font-semibold uppercase tracking-wider">Participants</p>
                  <p className="text-sm font-bold text-[var(--foreground)]">{claim.commits}</p>
                </div>
              </>
            )}
          </div>

          {/* Countdown */}
          {claim.commitEnd && claim.revealEnd && (claim.status === 'VOTING' || claim.status === 'REVEALING') && (
            <div className={`pt-6 border-t border-[var(--border)] mt-6 rounded-[var(--radius-sm)] px-4 py-3 ${isRevealPhase ? 'bg-amber-50 border border-amber-200' : 'bg-[var(--surface-raised)]'}`}>
              {isVotingPhase && <CountdownTimer endTimestamp={claim.commitEnd} label="Voting closes in" />}
              {isRevealPhase && <CountdownTimer endTimestamp={claim.revealEnd} label="Reveal closes in" variant="reveal" />}
            </div>
          )}

          {/* Final results */}
          {isResolved && hasVotes && totalVotes > 0 && (
            <div className="pt-6 border-t border-[var(--border)] mt-6">
              <p className="text-[10px] text-[var(--subtle)] font-semibold uppercase tracking-wider mb-5">Final Results</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-8" style={{ color: 'var(--yes-light)' }}>YES</span>
                  <div className="flex-1 h-1.5 bg-[var(--surface-raised)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${forPercent}%`, background: 'var(--yes-light)' }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[var(--foreground)] w-24 text-right tabular-nums">
                    {claim.votesFor} ({forPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-8" style={{ color: 'var(--no-light)' }}>NO</span>
                  <div className="flex-1 h-1.5 bg-[var(--surface-raised)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${againstPercent}%`, background: 'var(--no-light)' }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[var(--foreground)] w-24 text-right tabular-nums">
                    {claim.votesAgainst} ({againstPercent.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {claim.status === 'VOTING' && isVotingPhase && (
            <CommitForm
              eventId={claim.id}
              stakeAmount={claim.stakeAmount}
              currentCommits={claim.commits}
              poolSui={claim.poolSui}
              onSuccess={() => window.location.reload()}
            />
          )}

          {(claim.status === 'REVEALING' || (claim.status === 'VOTING' && !isVotingPhase)) && isRevealPhase && !needsResolve && (
            <RevealForm
              eventId={claim.id}
              revealEnd={claim.revealEnd}
              onSuccess={() => window.location.reload()}
            />
          )}

          {needsResolve && (
            <ResolveButton
              eventId={claim.id}
              revealEndTimestamp={claim.revealEnd}
              onSuccess={() => window.location.reload()}
            />
          )}

          {isResolved && userWon && claim.rewardPerWinner !== undefined && (
            <ClaimRewardButton
              eventId={claim.id}
              rewardPerWinner={claim.rewardPerWinner}
              stakeAmount={claim.stakeAmount}
              onSuccess={() => window.location.reload()}
            />
          )}

          {isResolved && claim.outcome === 'TIED' && savedCommit && claim.rewardPerWinner !== undefined && (
            <ClaimRewardButton
              eventId={claim.id}
              rewardPerWinner={0}
              stakeAmount={claim.stakeAmount}
              isTie={true}
              onSuccess={() => window.location.reload()}
            />
          )}

          {isResolved && !userWon && claim.outcome !== 'TIED' && (
            <div className="py-10 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] text-center shadow-[var(--shadow-sm)]">
              <div className="mb-3">
                {(claim.outcome === 'ACCEPTED' || claim.outcome === 'REJECTED') && (
                  <OutcomeBadge outcome={claim.outcome} />
                )}
              </div>
              <p className="text-sm text-[var(--subtle)]">
                Stakes have been distributed to the winning side.
              </p>
            </div>
          )}

          {isVoided && (
            <div className="py-10 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] text-center shadow-[var(--shadow-sm)]">
              <p className="text-sm font-semibold text-[var(--muted)]">Voided</p>
              <p className="text-xs text-[var(--subtle)] mt-1.5">No reveals were submitted. All stakes have been refunded.</p>
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}
