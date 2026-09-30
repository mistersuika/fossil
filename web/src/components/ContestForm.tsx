'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { generateCommitHash, generateSecret } from '@/lib/hash';
import { submitEvent } from '@/lib/wallet';
import { CopyButton } from './CopyButton';
import { Tooltip } from './Tooltip';

interface ContestFormProps {
  parentEventId: string;
  parentDescription: string;
  stakeAmount: number;
  onSuccess?: () => void;
}

export function ContestForm({ parentEventId, parentDescription, stakeAmount, onSuccess }: ContestFormProps) {
  const { connected, address } = useWallet();
  const [isExpanded, setIsExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [commitHours, setCommitHours] = useState('24');
  const [commitMinutes, setCommitMinutes] = useState('0');
  const [revealHours, setRevealHours] = useState('24');
  const [revealMinutes, setRevealMinutes] = useState('0');
  const [vote, setVote] = useState<boolean>(true);
  const [secret, setSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const handleGenerateSecret = () => {
    const newSecret = generateSecret();
    setSecret(newSecret);
    setShowSecret(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !description || !secret) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Calculate total minutes
      const totalCommitMinutes = parseInt(commitHours) * 60 + parseInt(commitMinutes);
      const totalRevealMinutes = parseInt(revealHours) * 60 + parseInt(revealMinutes);

      // Generate commit hash
      const commitHashBytes = generateCommitHash(address, vote, secret);
      const stakeInMist = BigInt(stakeAmount);
      const commitMs = BigInt(totalCommitMinutes * 60 * 1000);
      const revealMs = BigInt(totalRevealMinutes * 60 * 1000);

      // Note: Contest is submitted as a new event (SUI version doesn't have a separate Contest function)
      const { digest } = await submitEvent(description, '', 3, stakeInMist, commitMs, revealMs, commitHashBytes);

      const hashHex = Array.from(commitHashBytes, b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(`fossil_commit_new_${address}`, JSON.stringify({
        parentId: parentEventId,
        vote,
        secret,
        hashHex,
        digest,
        timestamp: Date.now()
      }));

      onSuccess?.();
    } catch (err) {
      // Improved error messages
      let errorMessage = 'Failed to submit contest';
      if (err instanceof Error) {
        if (err.message.includes('insufficient funds')) {
          errorMessage = `Insufficient SUI balance. You need ${(stakeAmount / 1_000_000_000).toFixed(2)} SUI to create a contest.`;
        } else if (err.message.includes('not resolved')) {
          errorMessage = 'Cannot contest an event that is not yet resolved.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return null; // Don't show contest button if not connected
  }

  if (!isExpanded) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] p-10">
        <div className="text-center space-y-6">
          <div>
            <h3 className="text-2xl font-light text-[var(--foreground)] mb-3">Contest this Result</h3>
            <p className="text-sm text-[var(--muted)] font-light">
              Think this result is incorrect? Create a new vote to contest this decision.
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full py-5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-light text-base hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors relative overflow-hidden group"
          >
            <span className="relative z-10">Create Contest</span>
          </button>
          <p className="text-xs text-[var(--muted)] font-light">
            Required stake: {(stakeAmount / 1_000_000_000).toFixed(2)} SUI
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-[var(--card)] border border-[var(--border)] p-10">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-light text-[var(--foreground)]">Contest Event #{parentEventId}</h3>
          <p className="text-sm text-[var(--muted)] mt-2 font-light">Propose a new version of this event</p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] font-light"
        >
          Cancel
        </button>
      </div>

      {/* Original Event */}
      <div className="p-5 border border-[var(--border)] bg-[var(--gray-light)]">
        <p className="text-xs text-[var(--muted)] mb-2 uppercase tracking-wider font-light">Contested Event</p>
        <p className="text-sm text-[var(--foreground)] font-light">{parentDescription}</p>
      </div>

      {/* New Description */}
      <div>
        <label className="block text-sm font-light text-[var(--foreground)] mb-3 uppercase tracking-wider">
          New Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe why you're contesting and what your version is..."
          rows={4}
          className="w-full px-5 py-4 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--foreground)] transition-colors font-light resize-none"
          required
          maxLength={500}
        />
        <p className="text-xs text-[var(--muted)] mt-2 font-light">{description.length}/500 characters</p>
      </div>

      {/* Vote Position */}
      <div>
        <label className="block text-sm font-light text-[var(--foreground)] mb-4 uppercase tracking-wider">
          Your Position
        </label>
        <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
          <button
            type="button"
            onClick={() => setVote(true)}
            className={`py-5 text-sm font-light uppercase tracking-widest transition-colors ${
              vote === true
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            VERIFY
          </button>
          <button
            type="button"
            onClick={() => setVote(false)}
            className={`py-5 text-sm font-light uppercase tracking-widest transition-colors ${
              vote === false
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            REJECT
          </button>
        </div>
      </div>

      {/* Phase Durations */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-light text-[var(--foreground)] mb-3 uppercase tracking-wider">
            Commit Phase Duration
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={commitHours}
                onChange={(e) => setCommitHours(e.target.value)}
                min="0"
                max="720"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)] font-light"
              />
              <p className="text-xs text-[var(--muted)] mt-1 font-light">Hours</p>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={commitMinutes}
                onChange={(e) => setCommitMinutes(e.target.value)}
                min="0"
                max="59"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)] font-light"
              />
              <p className="text-xs text-[var(--muted)] mt-1 font-light">Minutes</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-light text-[var(--foreground)] mb-3 uppercase tracking-wider">
            Reveal Phase Duration
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={revealHours}
                onChange={(e) => setRevealHours(e.target.value)}
                min="0"
                max="720"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)] font-light"
              />
              <p className="text-xs text-[var(--muted)] mt-1 font-light">Hours</p>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={revealMinutes}
                onChange={(e) => setRevealMinutes(e.target.value)}
                min="0"
                max="59"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)] font-light"
              />
              <p className="text-xs text-[var(--muted)] mt-1 font-light">Minutes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secret Generation */}
      <div>
        <label className="block text-sm font-light text-[var(--foreground)] mb-3 uppercase tracking-wider">
          Secret (Auto-Generated)
        </label>
        {!secret ? (
          <button
            type="button"
            onClick={handleGenerateSecret}
            className="w-full py-4 border border-[var(--border)] text-[var(--foreground)] font-light hover:border-[var(--foreground)] transition-colors"
          >
            Generate Secret
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 p-4 bg-[var(--background)] border border-[var(--border)] font-mono text-sm text-[var(--foreground)] break-all">
                {showSecret ? secret : '•'.repeat(64)}
              </div>
              {showSecret && <CopyButton text={secret} />}
            </div>
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] font-light"
            >
              {showSecret ? 'Hide' : 'Show'} secret
            </button>
            <div className="p-4 border border-[var(--foreground)] bg-[var(--gray-light)] text-[var(--foreground)] text-sm font-light">
              ⚠️ <strong>IMPORTANT:</strong> Save this secret! You'll need it to reveal your vote.
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-5 border border-[var(--foreground)] bg-[var(--gray-light)] text-[var(--foreground)] text-sm font-light">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!description || !secret || isSubmitting}
        className="w-full py-5 bg-[var(--foreground)] text-[var(--background)] font-light text-base disabled:opacity-30 disabled:cursor-not-allowed relative overflow-hidden group"
      >
        <span className="relative z-10 transition-colors duration-1000 group-hover:text-[var(--foreground)]">
          {isSubmitting ? 'Submitting...' : `Create Contest (${(stakeAmount / 1_000_000_000).toFixed(2)} SUI)`}
        </span>
        <div className="absolute inset-0 bg-[var(--background)] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 origin-left"></div>
      </button>

      <p className="text-xs text-[var(--muted)] text-center font-light">
        This contest will create a new event that challenges event #{parentEventId}
      </p>
    </form>
  );
}
