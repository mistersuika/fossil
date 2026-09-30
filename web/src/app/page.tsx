'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchEvents, fetchGlobalStats } from '@/lib/sui';
import { FossilClaim, CATEGORIES, Category } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { ClaimCard } from '@/components/ClaimCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { Footer } from '@/components/Footer';

type StatusFilter = 'voting' | 'revealing' | 'resolved';

const STATUS_LABELS: Record<StatusFilter, string> = {
  voting: 'Active',
  revealing: 'Reveal',
  resolved: 'Archived',
};

export default function HomePage() {
  const [claims, setClaims] = useState<FossilClaim[]>([]);
  const [uniqueVoters, setUniqueVoters] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('voting');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');

  useEffect(() => {
    async function load() {
      try {
        const [parsed, stats] = await Promise.all([fetchEvents(), fetchGlobalStats()]);
        setClaims(parsed);
        setUniqueVoters(stats.uniqueVoters);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(async () => {
      try {
        const [parsed, stats] = await Promise.all([fetchEvents(), fetchGlobalStats()]);
        setClaims(parsed);
        setUniqueVoters(stats.uniqueVoters);
      } catch { /* silent */ }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const activeClaims = claims.filter(c => c.status === 'VOTING' || c.status === 'REVEALING');
  const resolvedClaims = claims.filter(c => c.status === 'RESOLVED' || c.status === 'VOIDED');
  const totalSuiStaked = claims.reduce((sum, c) => sum + (c.poolSui || 0), 0);

  const filteredClaims = claims.filter(c => {
    const matchStatus =
      statusFilter === 'voting'    ? c.status === 'VOTING' :
      statusFilter === 'revealing' ? c.status === 'REVEALING' :
      c.status === 'RESOLVED' || c.status === 'VOIDED';
    const matchCat = categoryFilter === 'All' || c.category === categoryFilter;
    return matchStatus && matchCat;
  });

  const recentArchived = resolvedClaims.slice(0, 4);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <div className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-8">

        {/* HERO */}
        <section className="py-24 md:py-32 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--subtle)] font-medium mb-8">
            Collective Memory Protocol
          </div>
          <h1 className="text-7xl md:text-8xl font-bold text-[var(--foreground)] tracking-tight mb-7 leading-[0.95]">
            FOSSIL
          </h1>
          <p className="text-xl text-[var(--muted)] max-w-md mx-auto mb-4 font-light leading-relaxed">
            What humanity agreed to be true.
          </p>
          <p className="text-sm text-[var(--subtle)] max-w-sm mx-auto mb-12 leading-relaxed">
            An immutable registry of collective consensus.
            Every voted claim becomes permanent memory.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="#claims" className="btn-primary">
              Explore Claims
            </Link>
            <Link href="/submit" className="btn-secondary">
              Submit a Claim
            </Link>
          </div>
        </section>

        {/* STATS */}
        <section className="border-y border-[var(--border)] py-8 mb-24">
          <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
            <div className="text-center px-6">
              <div className="text-4xl font-bold text-[var(--foreground)] tracking-tight mb-1.5">
                {claims.length}
              </div>
              <div className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider">Claims</div>
            </div>
            <div className="text-center px-6">
              <div className="text-4xl font-bold text-[var(--foreground)] tracking-tight mb-1.5">
                {activeClaims.length}
              </div>
              <div className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider">Active</div>
            </div>
            <div className="text-center px-6">
              <div className="text-4xl font-bold text-[var(--foreground)] tracking-tight mb-1.5">
                {totalSuiStaked.toFixed(1)}
              </div>
              <div className="text-[11px] text-[var(--subtle)] font-medium uppercase tracking-wider">SUI Staked</div>
            </div>
          </div>
        </section>

        {/* CLAIMS */}
        <section id="claims" className="mb-24">
          <SectionHeader
            title="Claims"
            subtitle="Browse and vote on open claims"
          />

          {/* Status filter */}
          <div className="flex items-center gap-2 mb-4">
            {(['voting', 'revealing', 'resolved'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  statusFilter === f
                    ? 'bg-[var(--foreground)] text-white'
                    : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]'
                }`}
              >
                {STATUS_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 mb-10 flex-wrap">
            {(['All', ...CATEGORIES] as (Category | 'All')[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 text-[11px] font-medium rounded-full border transition-all ${
                  categoryFilter === cat
                    ? 'bg-[var(--foreground)] text-white border-[var(--foreground)]'
                    : 'bg-[var(--surface)] text-[var(--subtle)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-28">
              <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin mb-4" />
              <p className="text-xs text-[var(--subtle)] font-medium uppercase tracking-widest">Loading</p>
            </div>
          )}

          {error && !isLoading && (
            <EmptyState
              title="Could not load claims"
              description={error}
            />
          )}

          {!isLoading && !error && filteredClaims.length === 0 && (
            <EmptyState
              title="No claims found"
              description={statusFilter === 'voting' ? 'No active claims at this time.' : 'No claims in this category yet.'}
              action={statusFilter === 'voting' ? { label: 'Submit a Claim', href: '/submit' } : undefined}
            />
          )}

          {!isLoading && !error && filteredClaims.length > 0 && (
            <div className="space-y-4">
              {filteredClaims.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          )}
        </section>

        {/* RECENTLY ARCHIVED */}
        {!isLoading && recentArchived.length > 0 && (
          <section className="mb-24">
            <SectionHeader
              title="Recently Archived"
              subtitle="Claims that have reached consensus"
              action={{ label: 'View all', href: '/memoria' }}
            />
            <div className="space-y-4">
              {recentArchived.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          </section>
        )}

      </div>

      <Footer />
    </div>
  );
}
