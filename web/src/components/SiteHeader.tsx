'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { WalletConnect } from './WalletConnect';
import { NetworkGuard } from './NetworkGuard';
import { useWallet } from '@/contexts/WalletContext';

export function SiteHeader() {
  const { connected, address } = useWallet();
  const pathname = usePathname();
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
      router.push(`/profile?address=${encodeURIComponent(trimmed)}`);
      setSearchOpen(false);
      setSearchValue('');
    }
  };

  const handleSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchValue('');
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-md">
      <NetworkGuard />

      <div className="max-w-5xl mx-auto px-6 lg:px-8 h-[58px] flex items-center justify-between gap-4">

        <Link
          href="/"
          className="inline-flex items-center gap-2.5 hover:opacity-70 transition-opacity"
        >
          <img
            src="/fossil-mark-transparent.png"
            alt=""
            className="w-[19px] h-[19px] object-contain"
          />

          <span className="text-[13px] font-semibold tracking-[0.08em] text-[var(--foreground)] uppercase">
            Fossil
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {searchOpen ? (
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Sui address…"
                className="w-44 h-8 px-3 bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] text-[11px] text-[var(--foreground)] placeholder:text-[var(--subtle)] outline-none focus:border-[var(--border-strong)] font-mono"
              />

              <button
                type="submit"
                className="h-8 px-3 text-[11px] font-medium bg-[var(--foreground)] text-[var(--background)] rounded-[var(--radius-sm)]"
              >
                Go
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchValue('');
                }}
                className="p-1.5 text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close search"
              >
                ×
              </button>
            </form>
          ) : (
            <>
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors"
                title="Search by address"
                aria-label="Search by address"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              {connected && address && (
                <Link
                  href="/profile"
                  className={`p-1.5 transition-colors ${
                    pathname === '/profile'
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
                  }`}
                  title="My activity"
                  aria-label="My activity"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
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
