'use client';

import Link from 'next/link';

export function Footer() {
  const explorerUrl = `https://suiscan.xyz/testnet/object/${process.env.NEXT_PUBLIC_PACKAGE_ID}`;

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] mt-auto">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--foreground)] text-xs tracking-tight">FOSSIL</span>
            <span className="text-[var(--border)]">·</span>
            <a
              href="https://suikawaii.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:text-[var(--foreground)] transition-colors"
            >
              Powered by Suikawaii Labs
            </a>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/whitepaper"
              className="text-xs hover:text-[var(--foreground)] transition-colors"
            >
              Whitepaper
            </Link>
            <a
              href="https://sui.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:text-[var(--foreground)] transition-colors"
            >
              Sui
            </a>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:text-[var(--foreground)] transition-colors"
            >
              Contract
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
