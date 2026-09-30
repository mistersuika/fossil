'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { revealVote } from '@/lib/wallet';
import { CommitData } from '@/lib/types';

interface RevealFormProps {
  eventId: string;
  revealEnd?: number;
  onSuccess?: () => void;
}

export function RevealForm({ eventId, revealEnd, onSuccess }: RevealFormProps) {
  const { connected, address } = useWallet();
  const [savedCommit, setSavedCommit] = useState<CommitData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    // Primary key: set by CommitForm or SubmitForm after indexing
    const stored = localStorage.getItem(`fossil_commit_${eventId}_${address}`);
    if (stored) {
      try {
        setSavedCommit(JSON.parse(stored) as CommitData);
        return;
      } catch { /* ignore */ }
    }

    // Fallback: proposer's secret saved before indexing completed (SubmitForm pending key)
    const pending = localStorage.getItem(`fossil_pending_${address}`);
    if (pending) {
      try {
        const data = JSON.parse(pending) as CommitData;
        // Migrate to the correct key now that we know the eventId
        const withId = { ...data, eventId };
        localStorage.setItem(`fossil_commit_${eventId}_${address}`, JSON.stringify(withId));
        localStorage.removeItem(`fossil_pending_${address}`);
        setSavedCommit(withId);
      } catch { /* ignore */ }
    }
  }, [address, eventId]);

  const handleReveal = async () => {
    if (!address || !savedCommit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await revealVote(BigInt(eventId), savedCommit.vote, savedCommit.secret.trim());
      localStorage.removeItem(`fossil_commit_${eventId}_${address}`);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Urgency: less than 1 hour remaining
  const isUrgent = revealEnd !== undefined && (revealEnd - Date.now()) < 3_600_000 && (revealEnd - Date.now()) > 0;
  const minutesLeft = revealEnd ? Math.ceil((revealEnd - Date.now()) / 60_000) : null;

  if (!connected) {
    return (
      <div className="py-16 text-center bg-white rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow)]">
        <p className="text-[var(--muted)] font-medium">Connect your wallet to reveal</p>
      </div>
    );
  }

  // Detect wallet account switch — if the commit was made with a different address
  const wrongAccount = savedCommit && savedCommit.address && savedCommit.address !== address;

  if (!savedCommit || wrongAccount) {
    return (
      <div className="py-12 bg-white rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow)] text-center px-8">
        <div className="w-12 h-12 rounded-full bg-[var(--gray-light)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        {wrongAccount ? (
          <>
            <p className="text-base font-semibold text-[var(--foreground)] mb-2">Wrong account</p>
            <p className="text-sm text-[var(--muted)]">
              This vote was committed with account{' '}
              <span className="font-mono text-xs">{savedCommit!.address?.slice(0, 10)}…</span>.
              Switch to that account in your wallet to reveal.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-[var(--foreground)] mb-2">No vote found</p>
            <p className="text-sm text-[var(--muted)]">
              You either haven't voted, already revealed, or voted from a different browser.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[var(--radius)] border border-[var(--border)] p-8 shadow-[var(--shadow)] animate-slide-up">
      <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Reveal Your Vote</h3>
      <p className="text-sm text-[var(--muted)] mb-6">
        The reveal phase is open — reveal now to collect your winnings
      </p>

      {/* Saved vote display */}
      <div className={`rounded-xl p-6 mb-6 flex items-center gap-4 ${
        savedCommit.vote
          ? 'bg-[var(--yes-bg)] border border-[var(--yes-border)]'
          : 'bg-[var(--no-bg)] border border-[var(--no-border)]'
      }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
          savedCommit.vote ? 'bg-[var(--yes)] text-white' : 'bg-[var(--no)] text-white'
        }`}>
          {savedCommit.vote ? '✓' : '✗'}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-0.5">Your committed vote</p>
          <p className={`text-2xl font-bold ${savedCommit.vote ? 'text-[var(--yes)]' : 'text-[var(--no)]'}`}>
            {savedCommit.vote ? 'YES' : 'NO'}
          </p>
        </div>
      </div>

      {/* Urgency warning */}
      {isUrgent && minutesLeft !== null && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium mb-5">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Only {minutesLeft} minute{minutesLeft !== 1 ? 's' : ''} left to reveal!
        </div>
      )}

      {error && (
        <div className="p-4 rounded-[var(--radius-btn)] bg-[var(--no-bg)] border border-[var(--no-border)] text-[var(--no)] text-sm font-medium mb-5">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={isSubmitting}
        onClick={handleReveal}
        className="w-full py-4 bg-[#111827] text-white font-bold text-sm rounded-[var(--radius-btn)] hover:bg-[#1f2937] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Revealing...
          </>
        ) : 'Reveal My Vote'}
      </button>

      <p className="text-xs text-[var(--muted)] text-center mt-4">
        If you don't reveal before the deadline, you forfeit your stake.
      </p>
    </div>
  );
}
