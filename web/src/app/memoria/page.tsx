'use client';

import { useState, useEffect } from 'react';
import { fetchEvents } from '@/lib/sui';
import { FossilEvent, CATEGORIES, Category } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { ClaimCard } from '@/components/ClaimCard';
import { EmptyState } from '@/components/EmptyState';
import { Footer } from '@/components/Footer';

type SortOrder = 'newest' | 'oldest';
type OutcomeFilter = 'all' | 'true' | 'false';

export default function MemoriaPage() {
  const [detailedEvents, setDetailedEvents] = useState<FossilEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
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
    async function loadEvents() {
      try {
        const all = await fetchEvents();
        const archived = all.filter(e => e.status === 'RESOLVED' || e.status === 'VOIDED');
        setDetailedEvents(archived);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load archive');
      } finally {
        setIsLoading(false);
      }
    }
    loadEvents();
  }, []);

  const totalArchived = detailedEvents.length;
  const totalVotes = detailedEvents.reduce((sum, e) => sum + (e.reveals || 0), 0);
  const totalStaked = detailedEvents.reduce((sum, e) => sum + e.poolSui, 0);

  let filtered = detailedEvents.filter((e) => {
    const query = searchQuery.trim().toLowerCase();
    const matchSearch =
      !query ||
      e.description.toLowerCase().includes(query) ||
      e.context.toLowerCase().includes(query) ||
      e.category.toLowerCase().includes(query) ||
      e.id.toLowerCase().includes(query) ||
      e.proposer.toLowerCase().includes(query);
    const matchCat = categoryFilter === 'All' || e.category === categoryFilter;
    const matchOutcome =
      outcomeFilter === 'all'   ? true :
      outcomeFilter === 'true'  ? e.outcome === 'ACCEPTED' :
      e.outcome === 'REJECTED';
    return matchSearch && matchCat && matchOutcome;
  });

  if (sortOrder === 'oldest') {
    filtered = [...filtered].reverse();
  }

  const exportToCSV = () => {
    const headers = ['ID', 'Description', 'Status', 'Outcome', 'Reveals', 'Votes For', 'Votes Against', 'Pool (SUI)'];
    const rows = detailedEvents.map((e) => [
      e.id,
      `"${e.description.replace(/"/g, '""')}"`,
      e.status,
      e.outcome || 'N/A',
      e.reveals,
      e.votesFor || 0,
      e.votesAgainst || 0,
      e.poolSui,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fossil_archive_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <SiteHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
            <p className="text-xs text-[var(--subtle)] font-medium uppercase tracking-widest">Loading archive</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <SiteHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-[var(--muted)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <div className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-8">

        {/* Header */}
        <section className="py-20 border-b border-[var(--border)] mb-16">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--subtle)] font-medium mb-6">
            Collective Memory
          </div>
          <h1 className="text-5xl font-bold text-[var(--foreground)] tracking-tight mb-5 leading-tight">
            Archive
          </h1>
          <p className="text-base text-[var(--muted)] max-w-lg leading-relaxed">
            An immutable record of truths established by consensus.
            Each entry represents what an era held to be true.
          </p>

          {/* Stats inline */}
          <div className="flex items-center gap-8 mt-10 pt-8 border-t border-[var(--border)]">
            <div>
              <span className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{totalArchived}</span>
              <span className="text-xs text-[var(--subtle)] font-medium uppercase tracking-wider ml-2">Archived</span>
            </div>
            <div className="w-px h-6 bg-[var(--border)]" />
            <div>
              <span className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{totalVotes}</span>
              <span className="text-xs text-[var(--subtle)] font-medium uppercase tracking-wider ml-2">Votes cast</span>
            </div>
            <div className="w-px h-6 bg-[var(--border)]" />
            <div>
              <span className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{totalStaked.toFixed(1)}</span>
              <span className="text-xs text-[var(--subtle)] font-medium uppercase tracking-wider ml-2">SUI staked</span>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="space-y-4 mb-10">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the archive..."
              className="w-full pl-10 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--border-strong)] transition-all text-sm shadow-[var(--shadow-sm)]"
            />
          </div>

          {/* Filter row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
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

            <div className="flex items-center gap-2">
              {(['all', 'true', 'false'] as OutcomeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setOutcomeFilter(f)}
                  className={`px-3 py-1 text-[11px] font-medium rounded-full border transition-all ${
                    outcomeFilter === f
                      ? 'bg-[var(--foreground)] text-white border-[var(--foreground)]'
                      : 'bg-[var(--surface)] text-[var(--subtle)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'true' ? 'True' : 'False'}
                </button>
              ))}

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="px-3 py-1 text-[11px] font-medium rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] focus:outline-none focus:border-[var(--border-strong)] transition-all"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>

              <button
                onClick={exportToCSV}
                className="px-3 py-1 text-[11px] font-medium rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Results count */}
        {filtered.length > 0 && (
          <p className="text-xs text-[var(--subtle)] mb-6 font-medium">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </p>
        )}

        {/* Claims */}
        {filtered.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No results' : 'Archive is empty'}
            description={searchQuery ? 'Try a different query or remove filters.' : 'No claims have been archived yet.'}
          />
        ) : (
          <div className="space-y-4 pb-16">
            {filtered.map((event) => (
              <ClaimCard key={event.id} claim={event} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
