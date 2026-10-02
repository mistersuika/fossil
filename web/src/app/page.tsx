'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchEvents, fetchGlobalStats } from '@/lib/sui';
import { FossilClaim, CATEGORIES } from '@/lib/types';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@/contexts/WalletContext';
import { EmptyState } from '@/components/EmptyState';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  const { connected } = useWallet();

  const [claims, setClaims] = useState<FossilClaim[]>([]);
  const [uniqueVoters, setUniqueVoters] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const activeClaims = claims
    .filter(c => c.status === 'VOTING')
    .slice(0, 3);

  const revealClaims = claims
    .filter(c => c.status === 'REVEALING')
    .slice(0, 3);

  const archivedClaims = claims
    .filter(c => c.status === 'RESOLVED' || c.status === 'VOIDED')
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">

      <div className="flex-1 min-h-screen max-w-4xl w-full mx-auto px-6 lg:px-8">

        {/* DISCOVERY */}
        <section className="pt-40 md:pt-44 pb-16 text-center">

          <div className="flex items-center justify-center gap-2.5">
            <img
              src="/fossil-mark-transparent.png"
              alt=""
              className="w-[48px] md:w-[52px] h-auto shrink-0"
            />

            <h1 className="fossil-wordmark text-[46px] md:text-[52px] text-[var(--foreground)] leading-[0.95]">
              Fossil
            </h1>
          </div>

          <p className="mt-4 mx-auto max-w-md text-[13px] leading-relaxed text-[var(--muted)]">
            A public record of claims shaped by collective consensus.
          </p>



          <nav
            aria-label="Browse archive by category"
            className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-3"
          >
            {CATEGORIES.map((cat, index) => (
              <Link
                key={cat}
                href={`/archive?category=${encodeURIComponent(cat)}`}
                className="group inline-flex items-baseline gap-2"
              >
                <span className="font-mono text-[9px] tracking-[0.14em] text-[var(--subtle)]">
                  0{index + 1}
                </span>
                <span className="text-[11px] uppercase tracking-[0.12em] font-medium text-[var(--foreground)] group-hover:text-[var(--accent-hover)]">
                  {cat}
                </span>
              </Link>
            ))}
          </nav>

          <div className="max-w-[560px] mx-auto mt-8">
            <div className="flex items-stretch gap-3">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    window.location.href = `/archive?q=${encodeURIComponent(searchQuery.trim())}`;
                  }
                }}
                placeholder="Search the collective record..."
                className="flex-1 min-w-0 h-14 px-5 bg-[#FCFAF5] border border-[var(--border)] rounded-[14px] text-[15px] text-[var(--foreground)] placeholder:text-[var(--subtle)] outline-none focus:border-[var(--border-strong)]"
              />

              <Link
                href={searchQuery.trim() ? `/archive?q=${encodeURIComponent(searchQuery.trim())}` : '/archive'}
                className="h-14 px-6 inline-flex items-center justify-center rounded-[14px] bg-[var(--accent)] text-[var(--foreground)] text-sm font-semibold hover:bg-[var(--accent-hover)]"
              >
                Go
              </Link>
            </div>

            <div className="mt-5 flex justify-center">
              {!connected ? (
                <div className="fossil-wallet-cta">
                  <WalletConnect />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/submit"
                    style={{ color: '#F8F4EA' }}
                    className="px-4 py-2 text-xs font-semibold bg-[var(--foreground)] rounded-[var(--radius-sm)] hover:opacity-85 transition-opacity"
                  >
                    Propose a claim
                  </Link>

                  <Link
                    href="/profile"
                    className="px-4 py-2 text-xs font-semibold text-[var(--foreground)] border border-[var(--border-strong)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-raised)] transition-colors"
                  >
                    My activity
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {connected && (
          <div className="border-t border-[var(--border)] mb-14 md:mb-16" />
        )}

        {/* RECORD INDEX */}
        {connected ? (

          <section id="record" className="mb-28">

            <div>
              {isLoading && (
                <div className="py-16 text-center text-sm text-[var(--subtle)]">
                  Loading the record…
                </div>
              )}

              {error && !isLoading && (
                <div className="py-12">
                  <EmptyState
                    title="Could not load claims"
                    description={error}
                  />
                </div>
              )}

              {!isLoading && !error && (
                <div>
                  <div className="mb-8 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--subtle)]">
                    Participation
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-12 md:gap-x-16">

                  <div className="py-7">
                    <div className="mb-7">
                      <Link
                        href="/active"
                        className="inline-block text-[22px] font-semibold tracking-[-0.025em] text-[var(--foreground)] hover:underline underline-offset-4"
                      >
                        Active
                      </Link>

                      <p className="mt-1 text-[12px] text-[var(--subtle)]">
                        Open for participation
                      </p>
                    </div>

                    <div>
                      {activeClaims.length === 0 ? (
                        <p className="text-[13px] leading-relaxed text-[var(--subtle)] py-4">
                          No active claims.
                        </p>
                      ) : (
                        activeClaims.map((claim) => (
                          <Link
                            key={claim.id}
                            href={`/event/${claim.id}`}
                            className="block py-5 border-t border-[var(--border)]/70 group"
                          >
                            <p
                              title={claim.description}
                              className="fossil-claim-preview text-[15px] leading-[1.45] font-medium text-[var(--foreground)] group-hover:underline underline-offset-4"
                            >
                              {claim.description}
                            </p>

                            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--subtle)]">
                              {claim.category} · {claim.commits} {claim.commits === 1 ? 'commit' : 'commits'}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="py-7">
                    <div className="mb-7">
                      <Link
                        href="/reveal"
                        className="inline-block text-[22px] font-semibold tracking-[-0.025em] text-[var(--foreground)] hover:underline underline-offset-4"
                      >
                        Reveal
                      </Link>

                      <p className="mt-1 text-[12px] text-[var(--subtle)]">
                        Votes being revealed
                      </p>
                    </div>

                    <div>
                      {revealClaims.length === 0 ? (
                        <p className="text-[13px] leading-relaxed text-[var(--subtle)] py-4">
                          No claims in reveal.
                        </p>
                      ) : (
                        revealClaims.map((claim) => (
                          <Link
                            key={claim.id}
                            href={`/event/${claim.id}`}
                            className="block py-5 border-t border-[var(--border)]/70 group"
                          >
                            <p
                              title={claim.description}
                              className="fossil-claim-preview text-[15px] leading-[1.45] font-medium text-[var(--foreground)] group-hover:underline underline-offset-4"
                            >
                              {claim.description}
                            </p>

                            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--subtle)]">
                              {claim.category} · {claim.reveals} / {claim.commits} revealed
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                </div>
                </div>
              )}
            </div>

          </section>
        ) : null}

      </div>

      <Footer />
    </div>
  );
}
