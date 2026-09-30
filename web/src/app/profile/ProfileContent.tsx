'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchEvents, fetchUserStats } from '@/lib/sui';
import { UserStats } from '@/lib/types';
import { FossilEvent } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { ClaimCard } from '@/components/ClaimCard';
import { EmptyState } from '@/components/EmptyState';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@/contexts/WalletContext';
import { Footer } from '@/components/Footer';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--subtle)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-[var(--radius-sm)] transition-all"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-[var(--yes-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function ProfileContent() {
  const { connected, address } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();

  const targetAddress = searchParams.get('address') || address;
  const isViewingOwnProfile = targetAddress === address;

  const [detailedEvents, setDetailedEvents] = useState<FossilEvent[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetAddress) return;

    async function loadData() {
      setIsLoading(true);
      try {
        const [all, stats] = await Promise.all([
          fetchEvents(),
          fetchUserStats(targetAddress!),
        ]);
        setDetailedEvents(all);
        setUserStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [targetAddress]);

  if (!targetAddress) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5">
            <p className="text-sm text-[var(--muted)]">Connect your wallet to view your profile</p>
            <WalletConnect />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const myProposals = detailedEvents.filter(e =>
    e.proposer.toLowerCase() === targetAddress.toLowerCase() ||
    e.proposer.toLowerCase().includes(targetAddress.toLowerCase().slice(2, 10))
  );

  const needsReveal: FossilEvent[] = [];
  if (isViewingOwnProfile && address && typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('fossil_commit_') && !key.includes('_new_') && key.includes(address)) {
        try {
          const parts = key.split('_');
          const eventId = parts[2];
          if (eventId && !isNaN(Number(eventId))) {
            const event = detailedEvents.find(e => e.id === eventId && e.status === 'REVEALING');
            if (event && !needsReveal.find(e => e.id === eventId)) {
              needsReveal.push(event);
            }
          }
        } catch { /* ignore */ }
      }
    }
  }

  const totalVoted   = userStats?.totalVotes  || 0;
  const winRate      = userStats?.winRate      || 0;
  const totalStaked  = (userStats?.totalStaked || 0) / 1_000_000_000;
  const totalProposed = myProposals.length;

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
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <div className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-8 py-16">

        {/* Profile header */}
        <section className="mb-14 pb-10 border-b border-[var(--border)]">
          {!isViewingOwnProfile && (
            <div className="mb-5">
              <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium bg-[var(--surface-raised)] text-[var(--subtle)] border border-[var(--border)] rounded-full uppercase tracking-wider">
                Public Profile
              </span>
            </div>
          )}

          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--subtle)] font-medium mb-4">
                {isViewingOwnProfile ? 'My Profile' : 'Participant'}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-base font-mono font-semibold text-[var(--foreground)] tracking-tight">
                  {targetAddress.slice(0, 10)}...{targetAddress.slice(-8)}
                </code>
                <CopyButton text={targetAddress} />
              </div>
            </div>

            {isViewingOwnProfile && !connected && (
              <WalletConnect />
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-10 mt-8">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{totalProposed}</p>
              <p className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider mt-0.5">Proposed</p>
            </div>
            <div className="w-px h-8 bg-[var(--border)]" />
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{totalVoted}</p>
              <p className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider mt-0.5">Votes cast</p>
            </div>
            <div className="w-px h-8 bg-[var(--border)]" />
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{totalStaked.toFixed(1)}</p>
              <p className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider mt-0.5">SUI staked</p>
            </div>
            <div className="w-px h-8 bg-[var(--border)]" />
            <div>
              <p className={`text-2xl font-bold tracking-tight ${winRate >= 60 ? 'text-[var(--yes-light)]' : winRate >= 40 ? 'text-[var(--foreground)]' : winRate > 0 ? 'text-[var(--no-light)]' : 'text-[var(--foreground)]'}`}>
                {winRate > 0 ? `${winRate}%` : '—'}
              </p>
              <p className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider mt-0.5">Win rate</p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-8 p-4 rounded-[var(--radius)] bg-[var(--no-bg)] border border-[var(--no-border)] text-[var(--no)] text-sm">
            {error}
          </div>
        )}

        {/* Reveal alerts */}
        {needsReveal.length > 0 && (
          <div className="mb-10 bg-amber-50 border border-amber-200 rounded-[var(--radius)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-amber-800 mb-1">
                  {needsReveal.length} pending reveal{needsReveal.length > 1 ? 's' : ''}
                </h2>
                <p className="text-xs text-amber-700">
                  Confirm your votes before the deadline to claim your reward.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {needsReveal.map(event => (
                <Link
                  key={event.id}
                  href={`/event/${event.id}`}
                  className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-[var(--radius-sm)] hover:border-amber-400 transition-all"
                >
                  <p className="text-sm text-[var(--foreground)] line-clamp-1 flex-1">{event.description}</p>
                  <span className="text-xs font-semibold text-amber-600 ml-3 flex-shrink-0">Reveal →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Proposed claims */}
        <div className="mb-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">Proposed Claims</h2>
              <p className="text-sm text-[var(--subtle)] mt-1">
                {isViewingOwnProfile ? 'Claims you have submitted to the protocol' : 'Claims submitted by this address'}
              </p>
            </div>
            {myProposals.length > 0 && (
              <span className="text-xs text-[var(--subtle)] font-medium">{myProposals.length}</span>
            )}
          </div>

          {myProposals.length === 0 ? (
            <EmptyState
              title="No claims proposed"
              description={isViewingOwnProfile ? 'Submit your first claim to contribute to the collective archive.' : 'This address has not proposed any claims.'}
              action={isViewingOwnProfile ? { label: 'Submit a Claim', href: '/submit' } : undefined}
            />
          ) : (
            <div className="space-y-4">
              {myProposals.map(claim => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          )}
        </div>

      </div>

      <Footer />
    </div>
  );
}
