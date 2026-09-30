'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WalletConnect } from './WalletConnect';
import { NetworkGuard } from './NetworkGuard';
import { useWallet } from '@/contexts/WalletContext';

export function SiteHeader() {
  const { connected, address } = useWallet();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) {
      router.push(`/profile?address=${trimmed}`);
      setSearchOpen(false);
      setSearchValue('');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchValue('');
    }
  };

  return (
    <header className="bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] sticky top-0 z-50">
      <NetworkGuard />
      <div className="max-w-5xl mx-auto px-6 lg:px-8 h-[58px] flex items-center justify-between gap-4">

        {/* Left */}
        <div className="flex items-center gap-7">
          <Link
            href="/"
            className="text-sm font-bold text-[var(--foreground)] tracking-[0.05em] uppercase hover:opacity-70 transition-opacity"
          >
            FOSSIL
          </Link>
          <nav className="hidden sm:flex items-center gap-5">
            <Link
              href="/memoria"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-medium"
            >
              Archive
            </Link>
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 animate-slide-down">
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Sui address..."
                className="w-48 px-3 py-1.5 text-xs bg-[var(--surface-raised)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--foreground)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--border-strong)] font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] transition-all"
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchValue(''); }}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </form>
          ) : (
            <>
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors rounded-[var(--radius-sm)]"
                title="Search by address"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {connected && address && (
                <Link
                  href="/profile"
                  className="p-1.5 text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors rounded-[var(--radius-sm)]"
                  title="My profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
              )}

              <WalletConnect />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
