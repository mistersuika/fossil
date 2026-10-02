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

export function RevealForm({
  eventId,
  revealEnd,
  onSuccess,
}: RevealFormProps) {
  const { connected, address } = useWallet();
  const [savedCommit, setSavedCommit] = useState<CommitData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const stored = localStorage.getItem(
      `fossil_commit_${eventId}_${address}`
    );

    if (stored) {
      try {
        setSavedCommit(JSON.parse(stored) as CommitData);
        return;
      } catch {
        /* ignore */
      }
    }
  }, [address, eventId]);

  const handleReveal = async () => {
    if (!address || !savedCommit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await revealVote(
        BigInt(eventId),
        savedCommit.vote,
        savedCommit.secret.trim()
      );

      localStorage.removeItem(
        `fossil_commit_${eventId}_${address}`
      );

      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Transaction failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUrgent =
    revealEnd !== undefined &&
    revealEnd - Date.now() < 3_600_000 &&
    revealEnd - Date.now() > 0;

  const minutesLeft = revealEnd
    ? Math.ceil((revealEnd - Date.now()) / 60_000)
    : null;

  if (!connected) {
    return (
      <div className="border-t border-[var(--border)] pt-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          Participation
        </div>

        <p className="mt-4 text-[14px] text-[var(--muted)]">
          Connect your wallet to reveal your vote.
        </p>
      </div>
    );
  }

  const wrongAccount =
    savedCommit &&
    savedCommit.address &&
    savedCommit.address !== address;

  if (!savedCommit || wrongAccount) {
    return (
      <div className="border-t border-[var(--border)] pt-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          Participation
        </div>

        {wrongAccount ? (
          <>
            <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
              Wrong account
            </h3>

            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
              This vote was committed with{' '}
              <span className="font-mono text-[11px]">
                {savedCommit.address?.slice(0, 10)}…
              </span>
              . Switch to that account to reveal.
            </p>
          </>
        ) : (
          <>
            <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
              No pending reveal
            </h3>

            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
              No committed vote is available on this device. It may
              already have been revealed, or the original commitment
              may have been made elsewhere.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border)] pt-8">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
        Participation
      </div>

      <h3 className="mt-4 text-[21px] md:text-[23px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
        Reveal your vote
      </h3>

      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
        Reveal your committed position before the phase closes.
      </p>

      <div className="mt-7 max-w-2xl border-y border-[var(--border)] py-5 flex items-center justify-between gap-6">
        <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-[var(--subtle)]">
          Committed position
        </span>

        <span className="text-[15px] font-semibold text-[var(--foreground)]">
          {savedCommit.vote ? 'True' : 'False'}
        </span>
      </div>

      {isUrgent && minutesLeft !== null && (
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.09em] text-[var(--accent-hover)]">
          {minutesLeft} minute
          {minutesLeft !== 1 ? 's' : ''} remaining
        </p>
      )}

      {error && (
        <div className="mt-6 max-w-2xl border-y border-[var(--no-border)] py-4 text-[13px] leading-relaxed text-[var(--no-light)]">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={isSubmitting}
        onClick={handleReveal}
        className="mt-7 h-12 px-6 bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {isSubmitting ? 'Revealing…' : 'Reveal vote'}
      </button>

      <p className="mt-4 max-w-xl text-[11px] leading-relaxed text-[var(--subtle)]">
        Unrevealed votes forfeit their stake after the deadline.
      </p>
    </div>
  );
}
