'use client';

import { useState } from 'react';
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

  const stakeInSui = stakeAmount / 1_000_000_000;

  const handleVote = async (selectedVote: boolean) => {
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

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
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

  // Calculator
  const totalAfterYou = poolSui + stakeInSui;
  const assumedVoters = Math.max(currentCommits + 1, 2);
  const winningVoters = Math.ceil(assumedVoters / 2);
  const losingPool = ((assumedVoters - winningVoters) / assumedVoters) * totalAfterYou;
  const yourGain = (losingPool * 0.98) / winningVoters;

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-8 shadow-[var(--shadow-sm)] animate-slide-up">
      <h3 className="text-xl font-bold text-[var(--foreground)] mb-1 tracking-tight">Cast Your Vote</h3>
      <p className="text-sm text-[var(--muted)] mb-6">
        Stake {stakeInSui} SUI · Winners share the opposing pool
      </p>

      {error && (
        <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--no-bg)] border border-[var(--no-border)] text-[var(--no-light)] text-sm font-medium mb-5">
          {error}
        </div>
      )}

      {/* Vote buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleVote(true)}
          className="py-5 rounded-[var(--radius-sm)] text-sm font-bold bg-[var(--yes-bg)] border-2 border-[var(--yes-border)] hover:bg-[var(--yes)] hover:text-white hover:border-[var(--yes)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          style={{ color: isSubmitting && vote === true ? 'white' : 'var(--yes)' }}
        >
          {isSubmitting && vote === true ? (
            <>
              <span className="w-4 h-4 border-2 border-green-200 border-t-white rounded-full animate-spin" />
              Voting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              YES
            </>
          )}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleVote(false)}
          className="py-5 rounded-[var(--radius-sm)] text-sm font-bold bg-[var(--no-bg)] border-2 border-[var(--no-border)] hover:bg-[var(--no)] hover:text-white hover:border-[var(--no)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          style={{ color: isSubmitting && vote === false ? 'white' : 'var(--no)' }}
        >
          {isSubmitting && vote === false ? (
            <>
              <span className="w-4 h-4 border-2 border-red-200 border-t-white rounded-full animate-spin" />
              Voting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              NO
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-[var(--subtle)] text-center mt-4">
        Your vote is sealed until the confirmation phase. You must confirm it to collect winnings.
      </p>
    </div>
  );
}
