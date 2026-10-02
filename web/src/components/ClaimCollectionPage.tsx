'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { fetchEvents } from '@/lib/sui';
import { FossilClaim, CATEGORIES, Category } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { EmptyState } from '@/components/EmptyState';
import { Footer } from '@/components/Footer';

export type ClaimCollectionMode = 'active' | 'reveal' | 'archive';

const COPY = {
  active: {
    eyebrow: 'Participation',
    title: 'Active claims',
    description: 'Claims currently open for commitment.',
    empty: 'No claims are currently open for participation.',
  },
  reveal: {
    eyebrow: 'Reveal phase',
    title: 'Reveal',
    description: 'Claims whose committed votes can now be revealed.',
    empty: 'No claims are currently in the reveal phase.',
  },
  archive: {
    eyebrow: 'Collective record',
    title: 'Archive',
    description: 'Claims resolved by collective consensus.',
    empty: 'The archive is empty.',
  },
} as const;

export function ClaimCollectionPage({
  mode,
}: {
  mode: ClaimCollectionMode;
}) {
  const [claims, setClaims] = useState<FossilClaim[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState<Category | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const category = params.get('category');
    if (category && CATEGORIES.includes(category as Category)) {
      setCategoryFilter(category as Category);
    }

    const query = params.get('q');
    if (query) {
      setSearchQuery(query);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const all = await fetchEvents();

        const filteredByMode = all.filter((claim) => {
          if (mode === 'active') return claim.status === 'VOTING';
          if (mode === 'reveal') return claim.status === 'REVEALING';
          return claim.status === 'RESOLVED' || claim.status === 'VOIDED';
        });

        setClaims(filteredByMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load claims');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [mode]);

  const visibleClaims = claims.filter((claim) => {
    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      claim.description.toLowerCase().includes(query) ||
      claim.context.toLowerCase().includes(query) ||
      claim.category.toLowerCase().includes(query) ||
      claim.id.toLowerCase().includes(query) ||
      claim.proposer.toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === 'All' || claim.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const copy = COPY[mode];

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-8 py-16">
        <div className="mb-14">
          <Link
            href="/"
            className="text-[11px] text-[var(--subtle)] hover:text-[var(--foreground)]"
          >
            ← Fossil
          </Link>

          <div className="mt-10 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--subtle)]">
            {copy.eyebrow}
          </div>

          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {copy.title}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            {copy.description}
          </p>
        </div>

        <div className="mb-10">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              mode === 'archive'
                ? 'Search the archive...'
                : 'Search claims...'
            }
            className="w-full h-12 px-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--foreground)] placeholder:text-[var(--subtle)] outline-none focus:border-[var(--border-strong)]"
          />

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
            {(['All', ...CATEGORIES] as (Category | 'All')[]).map((category) => (
              <button
                key={category}
                onClick={() => setCategoryFilter(category)}
                className={`text-[11px] uppercase tracking-[0.1em] ${
                  categoryFilter === category
                    ? 'text-[var(--foreground)] underline underline-offset-4'
                    : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="py-20 text-center text-sm text-[var(--subtle)]">
            Loading…
          </div>
        )}

        {error && !isLoading && (
          <EmptyState
            title="Could not load claims"
            description={error}
          />
        )}

        {!isLoading && !error && visibleClaims.length === 0 && (
          <EmptyState
            title="Nothing here yet"
            description={copy.empty}
          />
        )}

        {!isLoading && !error && visibleClaims.length > 0 && (
          <div className="border-t border-[var(--border)]">
            {visibleClaims.map((claim) => (
              <Link
                key={claim.id}
                href={`/event/${claim.id}`}
                className="block py-6 border-b border-[var(--border)] group"
              >
                <div className="flex gap-6 justify-between">
                  <div className="min-w-0">
                    <p className="fossil-claim-preview text-[16px] leading-[1.5] font-medium text-[var(--foreground)] group-hover:underline underline-offset-4">
                      {claim.description}
                    </p>

                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--subtle)]">
                      {claim.category}
                      {mode === 'active' &&
                        ` · ${claim.commits} ${claim.commits === 1 ? 'commit' : 'commits'}`}
                      {mode === 'reveal' &&
                        ` · ${claim.reveals} / ${claim.commits} revealed`}
                      {mode === 'archive' &&
                        ` · ${claim.outcome ?? claim.status}`}
                    </p>
                  </div>

                  <span className="text-[var(--subtle)] group-hover:text-[var(--foreground)]">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
