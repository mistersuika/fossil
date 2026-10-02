'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { fetchEvents, fetchUserParticipationIds, fetchUserStats } from '@/lib/sui';
import {
  Category,
  CATEGORIES,
  FossilEvent,
  UserStats,
} from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@/contexts/WalletContext';
import { Footer } from '@/components/Footer';

type CategoryFilter = 'All' | Category;

type ActivityItem = {
  event: FossilEvent;
  proposed: boolean;
  participated: boolean;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ActivityRow({
  item,
  attention = false,
}: {
  item: ActivityItem;
  attention?: boolean;
}) {
  const { event, proposed, participated } = item;

  const role =
    proposed && participated
      ? 'Proposed · Participation'
      : proposed
        ? 'Proposed'
        : 'Participation';

  const state =
    attention
      ? 'Reveal required'
      : event.status === 'VOTING'
        ? 'Active'
        : event.status === 'REVEALING'
          ? 'Reveal'
          : event.status === 'VOIDED'
            ? 'Voided'
            : event.outcome || 'Resolved';

  const date = event.createdAt
    ? new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(event.createdAt))
    : '—';

  return (
    <Link
      href={`/event/${event.id}`}
      className="group grid grid-cols-[92px_minmax(0,1fr)_auto] md:grid-cols-[110px_minmax(0,1fr)_150px] items-center gap-5 py-4 border-b border-[var(--border)] hover:bg-[var(--surface-raised)]/35 transition-colors"
    >
      <span className="font-mono text-[9px] tracking-[0.04em] text-[var(--subtle)]">
        {date}
      </span>

      <div className="min-w-0">
        <p className="truncate text-[13px] md:text-[14px] font-medium tracking-[-0.01em] text-[var(--foreground)]">
          {event.description}
        </p>

        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.09em] text-[var(--subtle)]">
          {event.category} · {role}
        </p>
      </div>

      <div className="text-right">
        <span
          className={`font-mono text-[8px] uppercase tracking-[0.1em] ${
            attention
              ? 'text-[var(--accent-hover)]'
              : 'text-[var(--subtle)]'
          }`}
        >
          {state}
        </span>
      </div>
    </Link>
  );
}

function mergeActivity(
  proposed: FossilEvent[],
  participated: FossilEvent[],
) {
  const map = new Map<string, ActivityItem>();

  for (const event of proposed) {
    map.set(event.id, {
      event,
      proposed: true,
      participated: false,
    });
  }

  for (const event of participated) {
    const existing = map.get(event.id);

    if (existing) {
      existing.participated = true;
    } else {
      map.set(event.id, {
        event,
        proposed: false,
        participated: true,
      });
    }
  }

  return [...map.values()];
}

export default function ProfileContent() {
  const { address } = useWallet();
  const searchParams = useSearchParams();

  const targetAddress = searchParams.get('address') || address;

  const isViewingOwnProfile =
    !!address &&
    !!targetAddress &&
    address.toLowerCase() === targetAddress.toLowerCase();

  const [events, setEvents] = useState<FossilEvent[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [participationIds, setParticipationIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetAddress) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [allEvents, userStats, userParticipationIds] = await Promise.all([
          fetchEvents(),
          fetchUserStats(targetAddress!),
          fetchUserParticipationIds(targetAddress!),
        ]);

        setEvents(allEvents);
        setStats(userStats);
        setParticipationIds(userParticipationIds);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load activity'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [targetAddress]);

  if (!targetAddress) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-8 flex items-center">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--subtle)]">
              My activity
            </div>

            <h1 className="mt-3 text-[34px] md:text-[40px] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Join the consensus
            </h1>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Connect your wallet to access your activity.
            </p>

            <div className="mt-7">
              <WalletConnect />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const proposals = events.filter(
    (event) =>
      event.proposer.toLowerCase() ===
        targetAddress.toLowerCase() ||
      event.proposer
        .toLowerCase()
        .includes(targetAddress.toLowerCase().slice(2, 10))
  );

  const participation = events.filter((event) =>
    participationIds.includes(event.id)
  );

  const activity = mergeActivity(proposals, participation);

  const filteredActivity =
    categoryFilter === 'All'
      ? activity
      : activity.filter(
          (item) => item.event.category === categoryFilter
        );

  const revealIds = new Set(
    participation
      .filter((event) => event.status === 'REVEALING')
      .map((event) => event.id)
  );

  const revealCount = revealIds.size;

  const totalVotes = stats?.totalVotes || 0;
  const totalStaked =
    (stats?.totalStaked || 0) / 1_000_000_000;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <SiteHeader />

        <main className="flex-1 flex items-center justify-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
            Loading activity
          </p>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 lg:px-8">

        <section className="pt-12 md:pt-16 pb-8 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-8">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--subtle)]">
                {isViewingOwnProfile
                  ? 'Personal record'
                  : 'Participant'}
              </div>

              <h1 className="mt-3 text-[36px] md:text-[42px] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {isViewingOwnProfile
                  ? 'My activity'
                  : 'Activity'}
              </h1>

              <div className="mt-4 flex items-center gap-3">
                <code className="font-mono text-[10px] text-[var(--muted)]">
                  {targetAddress.slice(0, 10)}…
                  {targetAddress.slice(-8)}
                </code>

                <CopyButton text={targetAddress} />
              </div>
            </div>

            {isViewingOwnProfile && (
              <Link
                href="/submit"
                className="mt-5 inline-flex items-center gap-2 text-[12px] font-medium text-[var(--foreground)] hover:opacity-60 transition-opacity"
              >
                <span className="text-[var(--accent-hover)] text-[17px] leading-none">
                  +
                </span>
                Propose a claim
              </Link>
            )}
          </div>
        </section>

        <section className="flex flex-wrap gap-x-12 gap-y-5 py-6 border-b border-[var(--border)]">
          <div>
            <span className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {proposals.length}
            </span>
            <span className="ml-2 font-mono text-[8px] uppercase tracking-[0.11em] text-[var(--subtle)]">
              Proposed
            </span>
          </div>

          <div>
            <span className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {totalVotes}
            </span>
            <span className="ml-2 font-mono text-[8px] uppercase tracking-[0.11em] text-[var(--subtle)]">
              Participation
            </span>
          </div>

          <div>
            <span className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {totalStaked.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-[8px] uppercase tracking-[0.11em] text-[var(--subtle)]">
              SUI staked
            </span>
          </div>
        </section>

        {error && (
          <section className="py-5 border-b border-[var(--border)]">
            <p className="text-sm text-[var(--no-light)]">
              {error}
            </p>
          </section>
        )}

        <section className="py-6 border-b border-[var(--border)]">
          <nav className="flex flex-wrap gap-x-7 gap-y-3">
            {(['All', ...CATEGORIES] as CategoryFilter[]).map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`text-[10px] uppercase tracking-[0.1em] transition-colors ${
                    categoryFilter === category
                      ? 'text-[var(--foreground)] underline underline-offset-[6px]'
                      : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {category}
                </button>
              )
            )}
          </nav>
        </section>

        <section className="pt-8 pb-16">
          <div className="flex items-baseline justify-between gap-6 pb-4 border-b border-[var(--border)]">
            <h2 className="text-[18px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
              History
            </h2>

            <div className="flex items-center gap-4">
              {revealCount > 0 && (
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--accent-hover)]">
                  {revealCount} reveal
                  {revealCount > 1 ? 's' : ''} need attention
                </span>
              )}

              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--subtle)]">
                {filteredActivity.length}
              </span>
            </div>
          </div>

          {filteredActivity.length === 0 ? (
            <div className="py-9">
              <p className="text-[13px] text-[var(--subtle)]">
                No activity yet.
              </p>
            </div>
          ) : (
            <div>
              {filteredActivity.map((item) => (
                <ActivityRow
                  key={item.event.id}
                  item={item}
                  attention={
                    item.participated &&
                    revealIds.has(item.event.id)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
