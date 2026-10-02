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
import { ProfileLink } from '@/components/ProfileLink';
import { useWallet } from '@/contexts/WalletContext';
import { Footer } from '@/components/Footer';

export default function ClaimDetailPage() {
  const { address } = useWallet();
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

    const stored = localStorage.getItem(
      `fossil_commit_${eventId}_${address}`
    );

    const now = Date.now();

    const isRevealPhase =
      claim.commitEnd &&
      claim.revealEnd &&
      now >= claim.commitEnd &&
      now < claim.revealEnd;

    setHasPendingReveal(!!stored && !!isRevealPhase);
  }, [address, claim, eventId]);

  useEffect(() => {
    if (
      !claim ||
      claim.status === 'RESOLVED' ||
      claim.status === 'VOIDED'
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const parsed = await fetchEvent(eventId);
        setClaim(parsed);
      } catch {
        // silent refresh failure
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [claim, eventId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />

        <main className="flex-1 flex items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
            Loading claim
          </p>
        </main>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-8 py-20">
          <p className="text-sm text-[var(--muted)]">
            {error || 'Claim not found'}
          </p>

          <Link
            href="/"
            className="inline-block mt-8 text-xs text-[var(--foreground)] underline underline-offset-4"
          >
            Back to Fossil
          </Link>
        </main>

        <Footer />
      </div>
    );
  }

  const now = Date.now();

  const isVotingPhase =
    claim.commitEnd && now < claim.commitEnd;

  const isRevealPhase =
    claim.commitEnd &&
    claim.revealEnd &&
    now >= claim.commitEnd &&
    now < claim.revealEnd;

  const needsResolve =
    claim.revealEnd &&
    now >= claim.revealEnd &&
    claim.status !== 'RESOLVED' &&
    claim.status !== 'VOIDED';

  const isResolved = claim.status === 'RESOLVED';
  const isVoided = claim.status === 'VOIDED';

  const hasVotes =
    claim.votesFor !== undefined &&
    claim.votesAgainst !== undefined;

  const totalVotes = hasVotes
    ? claim.votesFor! + claim.votesAgainst!
    : 0;

  const forPercent =
    totalVotes > 0
      ? (claim.votesFor! / totalVotes) * 100
      : 0;

  const againstPercent =
    totalVotes > 0
      ? (claim.votesAgainst! / totalVotes) * 100
      : 0;

  const savedCommit = address
    ? (() => {
        try {
          const raw = localStorage.getItem(
            `fossil_commit_${eventId}_${address}`
          );

          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })()
    : null;

  const userWon =
    isResolved &&
    savedCommit &&
    claim.outcome !== 'TIED' &&
    claim.outcome !== 'PENDING' &&
    (
      (savedCommit.vote === true &&
        claim.outcome === 'ACCEPTED') ||
      (savedCommit.vote === false &&
        claim.outcome === 'REJECTED')
    );

  const backHref =
    claim.status === 'VOTING'
      ? '/active'
      : claim.status === 'REVEALING'
        ? '/reveal'
        : '/archive';

  const phaseLabel =
    claim.status === 'VOTING'
      ? 'Active claim'
      : claim.status === 'REVEALING'
        ? 'Reveal phase'
        : claim.status === 'VOIDED'
          ? 'Voided claim'
          : 'Archived claim';

  const formatDate = (timestamp?: number) =>
    timestamp
      ? new Intl.DateTimeFormat('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(timestamp))
      : null;

  const createdDate = formatDate(claim.createdAt);
  const resolvedDate = formatDate(claim.resolvedAt);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <main className="flex-1 min-h-[calc(100vh-58px)] w-full max-w-5xl mx-auto px-6 lg:px-8">

        {/* Document header */}
        <section className="pt-10 md:pt-14 pb-10 border-b border-[var(--border)]">
          <Link
            href={backHref}
            className="text-[11px] text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            {claim.status === 'VOTING'
              ? 'Active'
              : claim.status === 'REVEALING'
                ? 'Reveal'
                : 'Archive'}
          </Link>

          <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--subtle)]">
            <span>{phaseLabel}</span>
            <span>·</span>
            <span>{claim.category}</span>

            {claim.outcome &&
              claim.outcome !== 'PENDING' && (
                <>
                  <span>·</span>
                  <span>{claim.outcome}</span>
                </>
              )}
          </div>

          {(createdDate || resolvedDate) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] tracking-[0.06em] text-[var(--subtle)]">
              {createdDate && (
                <span>Created · {createdDate}</span>
              )}

              {createdDate && resolvedDate && (
                <span>·</span>
              )}

              {resolvedDate && (
                <span>Resolved · {resolvedDate}</span>
              )}
            </div>
          )}

          <h1 className="mt-5 max-w-4xl text-[30px] md:text-[38px] leading-[1.2] font-semibold tracking-[-0.035em] text-[var(--foreground)]">
            {claim.description}
          </h1>

          {claim.context && (
            <p className="mt-7 max-w-3xl text-[14px] md:text-[15px] leading-[1.75] text-[var(--muted)]">
              {claim.context}
            </p>
          )}
        </section>

        {/* Metadata */}
        <section className="py-7 border-b border-[var(--border)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-7">

            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--subtle)]">
                Proposer
              </p>

              <div className="mt-2">
                <ProfileLink
                  address={claim.proposer}
                  label=""
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--subtle)]">
                Stake
              </p>

              <p className="mt-2 text-[13px] font-medium text-[var(--foreground)]">
                {(claim.stakeAmount / 1_000_000_000).toFixed(2)} SUI
              </p>
            </div>

            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--subtle)]">
                Participants
              </p>

              <p className="mt-2 text-[13px] font-medium text-[var(--foreground)]">
                {claim.commits}
              </p>
            </div>

            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--subtle)]">
                Pool
              </p>

              <p className="mt-2 text-[13px] font-medium text-[var(--foreground)]">
                {claim.poolSui.toFixed
                  ? claim.poolSui.toFixed(2)
                  : claim.poolSui}{' '}
                SUI
              </p>
            </div>
          </div>
        </section>

        {/* Timing */}
        {(claim.status === 'VOTING' ||
          claim.status === 'REVEALING') &&
          claim.commitEnd &&
          claim.revealEnd && (
            <section className="py-7 border-b border-[var(--border)]">
              <div className="max-w-xl">
                {isVotingPhase && (
                  <CountdownTimer
                    endTimestamp={claim.commitEnd}
                    label="Voting closes in"
                  />
                )}

                {isRevealPhase && (
                  <CountdownTimer
                    endTimestamp={claim.revealEnd}
                    label="Reveal closes in"
                    variant="reveal"
                  />
                )}
              </div>

              {hasPendingReveal && (
                <p className="mt-4 text-[12px] text-[var(--accent-hover)]">
                  You have a committed vote ready to reveal.
                </p>
              )}
            </section>
          )}

        {/* Final result */}
        {isResolved && (
          <section className="py-9 border-b border-[var(--border)]">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--subtle)]">
              Final result
            </div>

            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-[24px] md:text-[28px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {claim.outcome || 'Resolved'}
              </span>

              {totalVotes > 0 && (
                <span className="text-xs text-[var(--subtle)]">
                  {totalVotes} revealed votes
                </span>
              )}
            </div>

            {hasVotes && totalVotes > 0 && (
              <div className="mt-8 max-w-2xl space-y-5">

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono uppercase tracking-[0.08em] text-[var(--subtle)]">
                      True
                    </span>

                    <span className="text-[var(--foreground)]">
                      {claim.votesFor} · {forPercent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-2 h-px bg-[var(--border)]">
                    <div
                      className="h-px bg-[var(--yes-light)]"
                      style={{ width: `${forPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono uppercase tracking-[0.08em] text-[var(--subtle)]">
                      False
                    </span>

                    <span className="text-[var(--foreground)]">
                      {claim.votesAgainst} · {againstPercent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-2 h-px bg-[var(--border)]">
                    <div
                      className="h-px bg-[var(--no-light)]"
                      style={{ width: `${againstPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Participation */}
        {(
          (claim.status === 'VOTING' && isVotingPhase) ||
          (
            (claim.status === 'REVEALING' ||
              (claim.status === 'VOTING' && !isVotingPhase)) &&
            isRevealPhase &&
            !needsResolve
          ) ||
          needsResolve ||
          (
            isResolved &&
            (
              (
                userWon &&
                claim.rewardPerWinner !== undefined
              ) ||
              (
                claim.outcome === 'TIED' &&
                savedCommit &&
                claim.rewardPerWinner !== undefined
              )
            )
          ) ||
          isVoided
        ) && (
          <section className="py-10 md:py-12 mb-16">
            <div className="max-w-2xl">

              {claim.status === 'VOTING' &&
                isVotingPhase && (
                  <CommitForm
                    eventId={claim.id}
                    stakeAmount={claim.stakeAmount}
                    currentCommits={claim.commits}
                    poolSui={claim.poolSui}
                    onSuccess={() => window.location.reload()}
                  />
                )}

              {(claim.status === 'REVEALING' ||
                (claim.status === 'VOTING' &&
                !isVotingPhase)) &&
                isRevealPhase &&
                !needsResolve && (
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

              {isResolved &&
                userWon &&
                claim.rewardPerWinner !== undefined && (
                  <ClaimRewardButton
                    eventId={claim.id}
                    rewardPerWinner={claim.rewardPerWinner}
                    stakeAmount={claim.stakeAmount}
                    onSuccess={() => window.location.reload()}
                  />
                )}

              {isResolved &&
                claim.outcome === 'TIED' &&
                savedCommit &&
                claim.rewardPerWinner !== undefined && (
                  <ClaimRewardButton
                    eventId={claim.id}
                    rewardPerWinner={0}
                    stakeAmount={claim.stakeAmount}
                    isTie={true}
                    onSuccess={() => window.location.reload()}
                  />
                )}

              {isVoided && (
                <div className="border-t border-[var(--border)] pt-7">
                  <p className="text-[13px] font-medium text-[var(--foreground)]">
                    Claim voided
                  </p>

                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--subtle)]">
                    No reveals were submitted.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
