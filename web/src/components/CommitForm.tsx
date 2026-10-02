'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { generateSecret, generateCommitHash } from '@/lib/hash';
import { commitVote } from '@/lib/wallet';

interface CommitFormProps {
  eventId: string;
  stakeAmount: number;
  currentCommits?: number;
  poolSui?: number;
  onSuccess?: () => void;
}

export function CommitForm({ eventId, stakeAmount, currentCommits = 0, poolSui = 0, onSuccess }: CommitFormProps) {
  const { connected, address } = useWallet();
  const [vote, setVote] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const stakeInSui = stakeAmount / 1_000_000_000;

  useEffect(() => {
    if (!address || typeof window === 'undefined') {
      setHasVoted(false);
      return;
    }

    const stored = localStorage.getItem(
      `fossil_commit_${eventId}_${address}`
    );

    setHasVoted(!!stored);
  }, [address, eventId]);

  const handleVote = async (selectedVote: boolean) => {
    if (!address) return;

    const existingCommit = localStorage.getItem(
      `fossil_commit_${eventId}_${address}`
    );

    if (existingCommit) {
      setHasVoted(true);
      return;
    }

    setVote(selectedVote);
    setError(null);

    if (stakeInSui > 10) {
      setShowConfirmation(true);
      return;
    }

    await submitVote(selectedVote);
  };

  const submitVote = async (selectedVote: boolean) => {
    if (!address) return;

    setIsSubmitting(true);
    setError(null);
    setShowConfirmation(false);

    try {
      const secret = generateSecret();
      const commitHashBytes = generateCommitHash(address, selectedVote, secret);
      const hashHex = Array.from(commitHashBytes, b => b.toString(16).padStart(2, '0')).join('');

      // Save secret BEFORE sending the transaction — if the browser crashes after
      // the tx lands but before setItem, the secret would be lost and the stake
      // would be unrecoverable. We overwrite with the digest once confirmed.
      localStorage.setItem(`fossil_commit_${eventId}_${address}`, JSON.stringify({
        eventId,
        vote: selectedVote,
        secret,
        hashHex,
        address,
        digest: null,
        timestamp: Date.now(),
      }));

      const { digest } = await commitVote(
        BigInt(eventId),
        commitHashBytes,
        BigInt(stakeAmount)
      );

      // Update with confirmed digest
      localStorage.setItem(`fossil_commit_${eventId}_${address}`, JSON.stringify({
        eventId,
        vote: selectedVote,
        secret,
        hashHex,
        address,
        digest,
        timestamp: Date.now(),
      }));

      setHasVoted(true);
      onSuccess?.();
    } catch (err) {
      localStorage.removeItem(
        `fossil_commit_${eventId}_${address}`
      );

      setHasVoted(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Transaction failed'
      );
      setVote(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="py-14 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
        <p className="text-[var(--muted)] font-medium text-sm">Connect your wallet to vote</p>
      </div>
    );
  }

  // Large stake confirmation
  if (showConfirmation && vote !== null) {
    return (
      <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-8 shadow-[var(--shadow-sm)] animate-scale-in">
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1 tracking-tight">Confirm Your Vote</h3>
        <p className="text-sm text-[var(--muted)] mb-6">You are about to stake a significant amount</p>

        <div className="bg-[var(--surface-raised)] rounded-[var(--radius-sm)] p-5 space-y-3 mb-6 border border-[var(--border)]">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Your position</span>
            <span className={`font-bold text-base ${vote ? 'text-[var(--yes-light)]' : 'text-[var(--no-light)]'}`}>
              {vote ? 'YES — True' : 'NO — False'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Amount staked</span>
            <span className="font-semibold text-[var(--foreground)]">{stakeInSui} SUI</span>
          </div>
          <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
            You will need to confirm your vote in a later step to collect potential winnings.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setShowConfirmation(false); setVote(null); }}
            className="flex-1 py-2.5 border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-[var(--radius-sm)] hover:border-[var(--border-strong)] transition-all text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => submitVote(vote)}
            className="flex-1 py-2.5 bg-[var(--accent)] text-white font-semibold rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all text-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Confirming...
              </>
            ) : 'Confirm Vote'}
          </button>
        </div>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="border-t border-[var(--border)] pt-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          Participation
        </div>

        <h3 className="mt-4 text-[21px] md:text-[23px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
          Voted
        </h3>

        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
          Your vote is committed and sealed until the reveal phase.
        </p>
      </div>
    );
  }

  // Calculator
  const totalAfterYou = poolSui + stakeInSui;
  const assumedVoters = Math.max(currentCommits + 1, 2);
  const winningVoters = Math.ceil(assumedVoters / 2);
  const losingPool = ((assumedVoters - winningVoters) / assumedVoters) * totalAfterYou;
  const yourGain = (losingPool * 0.98) / winningVoters;

  return (
    <div className="border-t border-[var(--border)] pt-8 animate-slide-up">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
        Participation
      </div>

      <h3 className="mt-4 text-[21px] md:text-[23px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
        Cast your vote
      </h3>

      <p className="mt-2 text-[13px] text-[var(--muted)]">
        Stake {stakeInSui} SUI · Winners share the opposing pool
      </p>

      {error && (
        <div className="mt-6 border-t border-b border-[var(--no-border)] py-4 text-[13px] text-[var(--no-light)]">
          {error}
        </div>
      )}

      <div className="mt-7 grid grid-cols-2 gap-3 max-w-2xl">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleVote(true)}
          className={`h-14 border rounded-[var(--radius-sm)] text-[12px] font-medium uppercase tracking-[0.08em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            vote === true
              ? 'border-[var(--foreground)] text-[var(--foreground)] bg-[var(--surface-raised)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]'
          }`}
        >
          {isSubmitting && vote === true
            ? 'Voting…'
            : 'True'}
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleVote(false)}
          className={`h-14 border rounded-[var(--radius-sm)] text-[12px] font-medium uppercase tracking-[0.08em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            vote === false
              ? 'border-[var(--foreground)] text-[var(--foreground)] bg-[var(--surface-raised)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]'
          }`}
        >
          {isSubmitting && vote === false
            ? 'Voting…'
            : 'False'}
        </button>
      </div>

      <p className="mt-5 max-w-2xl text-[11px] leading-relaxed text-[var(--subtle)]">
        Your vote is sealed until the reveal phase. You must reveal it to collect potential winnings.
      </p>
    </div>
  );

}
