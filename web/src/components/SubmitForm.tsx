'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { generateSecret, generateCommitHash } from '@/lib/hash';
import { submitEvent } from '@/lib/wallet';
import { getEventIdFromDigest } from '@/lib/sui';
import { CATEGORIES, CATEGORY_INDEX } from '@/lib/types';

async function waitForEventId(digest: string, maxAttempts = 8, delayMs = 1500): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, delayMs));
    const id = await getEventIdFromDigest(digest);
    if (id) return id;
  }
  return null;
}

interface SubmitFormProps {
  onSuccess?: (claimId: string) => void;
}

const CATEGORY_STYLES: Record<string, { active: string; idle: string }> = {
  Science:    { active: 'bg-slate-700 text-white border-slate-700',    idle: 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-slate-300 hover:text-slate-700' },
  Economics:  { active: 'bg-amber-600 text-white border-amber-600',   idle: 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-amber-300 hover:text-amber-700' },
  Politics:   { active: 'bg-red-700 text-white border-red-700',       idle: 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-red-300 hover:text-red-700' },
  Society:    { active: 'bg-purple-700 text-white border-purple-700', idle: 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-purple-300 hover:text-purple-700' },
  Technology: { active: 'bg-emerald-700 text-white border-emerald-700', idle: 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-emerald-300 hover:text-emerald-700' },
};

export function SubmitForm({ onSuccess }: SubmitFormProps) {
  const { connected, address } = useWallet();
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState<number>(0);
  const [stakeAmount, setStakeAmount] = useState('0.01');
  const [votingDays, setVotingDays]   = useState('0');
  const [votingHrs,  setVotingHrs]    = useState('1');
  const [votingMins, setVotingMins]   = useState('0');
  const [revealDays, setRevealDays]   = useState('0');
  const [revealHrs,  setRevealHrs]    = useState('1');
  const [revealMins, setRevealMins]   = useState('0');
  const [myVote, setMyVote] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'signing' | 'indexing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [successDigest, setSuccessDigest] = useState<string | null>(null);

  const stake = parseFloat(stakeAmount) || 0;
  const stakeError = stake < 0.01 ? 'Minimum stake is 0.01 SUI' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    if (!description.trim()) { setError('Claim cannot be empty'); return; }
    if (description.length > 280) { setError('Claim too long (max 280 characters)'); return; }
    if (context.length > 500) { setError('Context too long (max 500 characters)'); return; }
    if (stake < 0.01) { setError('Minimum stake is 0.01 SUI'); return; }

    const votingMinutes = (parseInt(votingDays)||0)*1440 + (parseInt(votingHrs)||0)*60 + (parseInt(votingMins)||0);
    const revealMinutes = (parseInt(revealDays)||0)*1440 + (parseInt(revealHrs)||0)*60 + (parseInt(revealMins)||0);

    if (votingMinutes < 1) { setError('Voting phase must last at least 1 minute'); return; }
    if (revealMinutes < 1) { setError('Reveal phase must last at least 1 minute'); return; }
    if (votingMinutes > 43200) { setError('Voting phase cannot exceed 30 days'); return; }
    if (revealMinutes > 43200) { setError('Reveal phase cannot exceed 30 days'); return; }

    if (stake > 10 && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('signing');
    setError(null);
    setShowConfirmation(false);

    try {
      const secret = generateSecret();
      const commitHashBytes = generateCommitHash(address, myVote, secret);
      const hashHex = Array.from(commitHashBytes, b => b.toString(16).padStart(2, '0')).join('');
      const stakeInMist = BigInt(Math.floor(stake * 1_000_000_000));
      const commitMs = BigInt(votingMinutes * 60 * 1000);
      const revealMs = BigInt(revealMinutes * 60 * 1000);

      // Save secret BEFORE submitting — if the browser crashes or indexing times out,
      // RevealForm will recover it from this pending key.
      const pendingKey = `fossil_pending_${address}`;
      localStorage.setItem(pendingKey, JSON.stringify({
        vote: myVote,
        secret,
        hashHex,
        address,
        timestamp: Date.now(),
      }));

      const { digest } = await submitEvent(
        description,
        context,
        category,
        stakeInMist,
        commitMs,
        revealMs,
        commitHashBytes
      );

      // Transaction signed — now wait for the node to index it
      setSubmitStatus('indexing');

      const eventId = await waitForEventId(digest);

      if (eventId) {
        // Migrate from pending key to the correct commit key
        localStorage.setItem(`fossil_commit_${eventId}_${address}`, JSON.stringify({
          eventId,
          vote: myVote,
          secret,
          hashHex,
          address,
          digest,
          timestamp: Date.now(),
        }));
        localStorage.removeItem(pendingKey);
        onSuccess?.(eventId);
      } else {
        // Indexing timed out — secret is still safe under pendingKey.
        // RevealForm will recover it when the user visits the event page.
        setSuccessDigest(digest);
      }
    } catch (err) {
      let errorMessage = 'Transaction failed';
      if (err instanceof Error) {
        if (err.message.includes('insufficient funds') || err.message.includes('InsufficientCoinBalance')) {
          errorMessage = `Insufficient SUI balance. You need at least ${stake} SUI.`;
        } else if (err.message.includes('rejected') || err.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setSubmitStatus('idle');
    }
  };

  // Fallback success screen if indexing timed out
  if (successDigest) {
    return (
      <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-8 shadow-[var(--shadow-sm)] text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--yes-bg)] border border-[var(--yes-border)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[var(--yes-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Claim submitted</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Your transaction was confirmed on-chain. Go to the home page to see your claim.
        </p>
        <p className="text-xs font-mono text-[var(--subtle)] bg-[var(--surface-raised)] rounded px-3 py-2 mb-6 break-all">
          {successDigest}
        </p>
        <a
          href="/"
          className="btn-primary inline-block"
        >
          Go to Home
        </a>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="py-14 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
        <p className="text-[var(--muted)] font-medium text-sm mb-4">Connect your wallet to submit a claim</p>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-8 shadow-[var(--shadow-sm)] animate-scale-in">
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1 tracking-tight">Confirm Your Claim</h3>
        <p className="text-sm text-[var(--muted)] mb-6">Review before submitting</p>
        <div className="bg-[var(--surface-raised)] rounded-[var(--radius-sm)] p-5 space-y-3 mb-6 text-sm border border-[var(--border)]">
          <div className="flex justify-between gap-4">
            <span className="text-[var(--muted)] flex-shrink-0">Claim</span>
            <span className="text-[var(--foreground)] font-medium text-right">{description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Your vote</span>
            <span className={`font-bold ${myVote ? 'text-[var(--yes-light)]' : 'text-[var(--no-light)]'}`}>
              {myVote ? 'YES — True' : 'NO — False'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Stake</span>
            <span className="font-semibold text-[var(--foreground)]">{stake} SUI</span>
          </div>
          <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
            This cannot be undone. You must confirm your vote in the confirmation phase to collect winnings.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowConfirmation(false)}
            className="flex-1 py-2.5 border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-[var(--radius-sm)] hover:border-[var(--border-strong)] transition-all text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="flex-1 py-2.5 bg-[var(--accent)] text-white font-semibold rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all text-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-8 shadow-[var(--shadow-sm)]">

      {/* Category */}
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat, i) => {
            const colors = CATEGORY_STYLES[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(CATEGORY_INDEX[cat])}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                  category === i ? colors.active : colors.idle
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Claim text */}
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
          Claim Statement
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="The Renaissance marked the birth of modern science"
          className={`w-full px-4 py-3 bg-[var(--background)] border rounded-[var(--radius-sm)] transition-all text-[var(--foreground)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 resize-none text-sm ${
            description.length > 280
              ? 'border-[var(--no-light)] focus:ring-red-100'
              : 'border-[var(--border)] focus:border-[var(--border-strong)] focus:ring-gray-100'
          }`}
          rows={3}
          maxLength={290}
        />
        <p className={`text-xs mt-1.5 font-medium ${description.length > 280 ? 'text-[var(--no-light)]' : 'text-[var(--muted)]'}`}>
          {description.length}/280
        </p>
      </div>

      {/* Context */}
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
          Context{' '}
          <span className="font-normal text-[var(--muted)] text-xs">(optional — sources, background)</span>
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Provide sources or context that help voters make an informed decision..."
          className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--foreground)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-gray-100 transition-all resize-none text-sm"
          rows={3}
          maxLength={500}
        />
        <p className="text-xs mt-1.5 text-[var(--muted)] font-medium">{context.length}/500</p>
      </div>

      {/* Stake */}
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
          Stake (SUI)
        </label>
        <input
          type="number"
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          min="0.01"
          step="0.01"
          className={`w-full px-4 py-2.5 bg-[var(--background)] border rounded-[var(--radius-sm)] focus:outline-none focus:ring-2 text-[var(--foreground)] transition-all text-sm ${
            stakeError ? 'border-[var(--no-light)] focus:ring-red-100' : 'border-[var(--border)] focus:border-[var(--border-strong)] focus:ring-gray-100'
          }`}
        />
        {stakeError
          ? <p className="text-xs mt-1.5 text-[var(--no-light)] font-medium">{stakeError}</p>
          : <p className="text-xs mt-1.5 text-[var(--muted)]">Min. 0.01 SUI</p>
        }
      </div>

      {/* Durations */}
      {(['Voting', 'Reveal'] as const).map((label) => {
        const days  = label === 'Voting' ? votingDays  : revealDays;
        const hrs   = label === 'Voting' ? votingHrs   : revealHrs;
        const mins  = label === 'Voting' ? votingMins  : revealMins;
        const setD  = label === 'Voting' ? setVotingDays  : setRevealDays;
        const setH  = label === 'Voting' ? setVotingHrs   : setRevealHrs;
        const setM  = label === 'Voting' ? setVotingMins  : setRevealMins;
        return (
          <div key={label}>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              {label} phase duration
              <span className="font-normal text-[var(--muted)] text-xs ml-2">max 30 days</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: days, set: setD, max: 30,  suffix: 'd' },
                { val: hrs,  set: setH, max: 23,  suffix: 'h' },
                { val: mins, set: setM, max: 59,  suffix: 'm' },
              ].map(({ val, set, max, suffix }) => (
                <div key={suffix} className="relative">
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    min="0"
                    max={max}
                    className="w-full pl-3 pr-8 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--foreground)] focus:outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-gray-100 transition-all text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--subtle)] font-semibold pointer-events-none">{suffix}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Your vote */}
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
          Your Vote
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMyVote(true)}
            className={`py-4 text-sm font-bold rounded-[var(--radius-sm)] border-2 transition-all flex items-center justify-center gap-2 ${
              myVote
                ? 'bg-[var(--yes)] text-white border-[var(--yes)]'
                : 'bg-[var(--yes-bg)] border-[var(--yes-border)] hover:border-[var(--yes)]'
            }`}
            style={{ color: myVote ? 'white' : 'var(--yes)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            YES
          </button>
          <button
            type="button"
            onClick={() => setMyVote(false)}
            className={`py-4 text-sm font-bold rounded-[var(--radius-sm)] border-2 transition-all flex items-center justify-center gap-2 ${
              !myVote
                ? 'bg-[var(--no)] text-white border-[var(--no)]'
                : 'bg-[var(--no-bg)] border-[var(--no-border)] hover:border-[var(--no)]'
            }`}
            style={{ color: !myVote ? 'white' : 'var(--no)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            NO
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--no-bg)] border border-[var(--no-border)] text-[var(--no-light)] text-sm font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!description || !!stakeError || isSubmitting}
        className="w-full py-3.5 bg-[var(--accent)] text-white font-bold text-sm rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {submitStatus === 'signing' ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Waiting for signature...
          </>
        ) : submitStatus === 'indexing' ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Confirming on-chain...
          </>
        ) : `Submit Claim — ${stake.toFixed(2)} SUI`}
      </button>

      <p className="text-xs text-[var(--subtle)] text-center">
        After voting closes, you will need to confirm your vote to collect potential winnings.
      </p>
    </form>
  );
}
