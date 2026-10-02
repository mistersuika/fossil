'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { fetchEvents } from '@/lib/sui';
import { FossilClaim, CATEGORIES, Category } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';

type Mode = 'active' | 'reveal' | 'archive';
type OutcomeFilter = 'all' | 'accepted' | 'rejected' | 'voided';
type SortOrder = 'newest' | 'oldest';

const COPY = {
  active: {
    index: '01',
    eyebrow: 'Participation',
    title: 'Active claims',
    description: 'Claims currently open for participation.',
    empty: 'No claims are currently open for participation.',
  },
  reveal: {
    index: '02',
    eyebrow: 'Disclosure',
    title: 'Reveal',
    description: 'Committed votes currently being revealed.',
    empty: 'No claims are currently in the reveal phase.',
  },
  archive: {
    index: '03',
    eyebrow: 'Collective record',
    title: 'Archive',
    description: 'Claims resolved through collective consensus.',
    empty: 'No claims have been archived yet.',
  },
} as const;

export function RecordIndexPage({ mode }: { mode: Mode }) {
  const [claims, setClaims] = useState<FossilClaim[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState<Category | 'All'>('All');
  const [outcomeFilter, setOutcomeFilter] =
    useState<OutcomeFilter>('all');
  const [sortOrder, setSortOrder] =
    useState<SortOrder>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[mode];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const category = params.get('category');
    if (category && CATEGORIES.includes(category as Category)) {
      setCategoryFilter(category as Category);
    }

    const query = params.get('q');
    if (query) setSearchQuery(query);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const all = await fetchEvents();

        setClaims(
          all.filter((claim) => {
            if (mode === 'active') return claim.status === 'VOTING';
            if (mode === 'reveal') return claim.status === 'REVEALING';

            return (
              claim.status === 'RESOLVED' ||
              claim.status === 'VOIDED'
            );
          })
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load claims'
        );
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [mode]);

  let filtered = claims.filter((claim) => {
    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      claim.description.toLowerCase().includes(query) ||
      claim.context.toLowerCase().includes(query) ||
      claim.category.toLowerCase().includes(query) ||
      claim.id.toLowerCase().includes(query) ||
      claim.proposer.toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === 'All' ||
      claim.category === categoryFilter;

    let matchesOutcome = true;

    if (mode === 'archive') {
      if (outcomeFilter === 'accepted') {
        matchesOutcome = claim.outcome === 'ACCEPTED';
      }

      if (outcomeFilter === 'rejected') {
        matchesOutcome = claim.outcome === 'REJECTED';
      }

      if (outcomeFilter === 'voided') {
        matchesOutcome = claim.status === 'VOIDED';
      }
    }

    return matchesSearch && matchesCategory && matchesOutcome;
  });

  if (sortOrder === 'oldest') {
    filtered = [...filtered].reverse();
  }

  const exportToCSV = () => {
    const headers = [
      'ID',
      'Statement',
      'Category',
      'Status',
      'Outcome',
      'Commits',
      'Reveals',
      'Pool (SUI)',
    ];

    const rows = filtered.map((claim) => [
      claim.id,
      `"${claim.description.replace(/"/g, '""')}"`,
      claim.category,
      claim.status,
      claim.outcome || 'N/A',
      claim.commits,
      claim.reveals,
      claim.poolSui,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `fossil_archive_${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <main className="flex-1 min-h-[calc(100vh-58px)] w-full max-w-5xl mx-auto px-6 lg:px-8">

        {/* Page identity */}
        <section className="pt-10 md:pt-14 pb-10 border-b border-[var(--border)]">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--subtle)]">
              {copy.eyebrow}
            </span>
          </div>

          <h1 className="mt-3 text-[36px] md:text-[42px] leading-none font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {copy.title}
          </h1>

          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-[var(--muted)]">
            {copy.description}
          </p>
        </section>

        {/* Search + categories */}
        <section className="py-8 border-b border-[var(--border)]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              mode === 'archive'
                ? 'Search the collective record...'
                : 'Search claims...'
            }
            className="w-full h-12 px-4 bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] text-[14px] text-[var(--foreground)] placeholder:text-[var(--subtle)] outline-none focus:border-[var(--border-strong)]"
          />

          <nav className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
            {(['All', ...CATEGORIES] as (Category | 'All')[]).map(
              (category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`text-[10px] uppercase tracking-[0.1em] transition-colors ${
                    categoryFilter === category
                      ? 'text-[var(--foreground)] underline underline-offset-4'
                      : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {category}
                </button>
              )
            )}
          </nav>

          {/* Archive-only secondary controls */}
          {mode === 'archive' && (
            <div className="mt-7 pt-5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {(
                  [
                    ['all', 'All outcomes'],
                    ['accepted', 'Accepted'],
                    ['rejected', 'Rejected'],
                    ['voided', 'Voided'],
                  ] as [OutcomeFilter, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setOutcomeFilter(value)}
                    className={`text-[10px] uppercase tracking-[0.08em] ${
                      outcomeFilter === value
                        ? 'text-[var(--foreground)] underline underline-offset-4'
                        : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-5">
                <div className="flex items-center gap-4">
                  {[
                    ['newest', 'Newest'],
                    ['oldest', 'Oldest'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSortOrder(value as SortOrder)}
                      className={`text-[10px] uppercase tracking-[0.08em] ${
                        sortOrder === value
                          ? 'text-[var(--foreground)] underline underline-offset-4'
                          : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={exportToCSV}
                  className="text-[10px] uppercase tracking-[0.08em] text-[var(--subtle)] hover:text-[var(--foreground)]"
                >
                  Export CSV
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Count */}
        {!isLoading && !error && (
          <div className="py-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--subtle)]">
              {filtered.length}{' '}
              {filtered.length === 1 ? 'claim' : 'claims'}
            </span>
          </div>
        )}

        {/* State */}
        {isLoading && (
          <div className="py-24 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
              Loading
            </p>
          </div>
        )}

        {error && !isLoading && (
          <div className="py-24 text-center">
            <p className="text-sm text-[var(--muted)]">
              {error}
            </p>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="py-14 md:py-16 border-t border-[var(--border)] text-center">
            <p className="text-[15px] font-medium text-[var(--foreground)]">
              Nothing here yet
            </p>

            <p className="mt-2 text-[12px] text-[var(--subtle)]">
              {copy.empty}
            </p>
          </div>
        )}

        {/* Record */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="border-t border-[var(--border)] mb-20">
            {filtered.map((claim) => {
              const date = claim.createdAt
                ? new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }).format(new Date(claim.createdAt))
                : '—';

              return (
                <Link
                  key={claim.id}
                  href={`/event/${claim.id}`}
                  className="group block border-b border-[var(--border)] hover:bg-[var(--surface-raised)]/35 transition-colors"
                >
                  {mode === 'archive' ? (
                    <div className="grid grid-cols-[92px_minmax(0,1fr)_auto] md:grid-cols-[110px_minmax(0,1fr)_140px] items-center gap-5 py-5 md:py-6">
                      <span className="font-mono text-[9px] tracking-[0.04em] text-[var(--subtle)]">
                        {date}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-[14px] md:text-[15px] font-medium tracking-[-0.01em] text-[var(--foreground)]">
                          {claim.description}
                        </p>

                        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.09em] text-[var(--subtle)]">
                          {claim.category}
                        </p>
                      </div>

                      <span className="text-right font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--subtle)]">
                        {claim.status === 'VOIDED'
                          ? 'Voided'
                          : claim.outcome || 'Resolved'}
                      </span>
                    </div>
                  ) : (
                    <div className="py-6 md:py-7">
                      <p className="fossil-claim-preview max-w-3xl text-[16px] md:text-[17px] leading-[1.5] font-medium tracking-[-0.01em] text-[var(--foreground)]">
                        {claim.description}
                      </p>

                      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.09em] text-[var(--subtle)]">
                        {claim.category}

                        {mode === 'active' && (
                          <>
                            {' · '}
                            {claim.commits}{' '}
                            {claim.commits === 1 ? 'commit' : 'commits'}
                          </>
                        )}

                        {mode === 'reveal' && (
                          <>
                            {' · '}
                            {claim.reveals} / {claim.commits} revealed
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
