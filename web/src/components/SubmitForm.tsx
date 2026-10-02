'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { generateSecret, generateCommitHash } from '@/lib/hash';
import { submitEvent } from '@/lib/wallet';
import { getEventIdFromDigest } from '@/lib/sui';
import { CATEGORIES, CATEGORY_INDEX } from '@/lib/types';

async function waitForEventId(
  digest: string,
  maxAttempts = 8,
  delayMs = 1500
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const id = await getEventIdFromDigest(digest);

    if (id) return id;
  }

  return null;
}

interface SubmitFormProps {
  onSuccess?: (claimId: string) => void;
}

export function SubmitForm({ onSuccess }: SubmitFormProps) {
  const { connected, address } = useWallet();

  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState<number>(0);
  const [stakeAmount, setStakeAmount] = useState('0.01');

  const [votingDays, setVotingDays] = useState('0');
  const [votingHrs, setVotingHrs] = useState('1');
  const [votingMins, setVotingMins] = useState('0');

  const [revealDays, setRevealDays] = useState('0');
  const [revealHrs, setRevealHrs] = useState('1');
  const [revealMins, setRevealMins] = useState('0');

  const [myVote, setMyVote] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] =
    useState<'idle' | 'signing' | 'indexing'>('idle');

  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [successDigest, setSuccessDigest] = useState<string | null>(null);

  const stake = parseFloat(stakeAmount) || 0;
  const stakeError =
    stake < 0.01 ? 'Minimum stake is 0.01 SUI' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) return;

    if (!description.trim()) {
      setError('Claim cannot be empty');
      return;
    }

    if (description.length > 280) {
      setError('Claim too long (max 280 characters)');
      return;
    }

    if (context.length > 500) {
      setError('Context too long (max 500 characters)');
      return;
    }

    if (stake < 0.01) {
      setError('Minimum stake is 0.01 SUI');
      return;
    }

    const votingMinutes =
      (parseInt(votingDays) || 0) * 1440 +
      (parseInt(votingHrs) || 0) * 60 +
      (parseInt(votingMins) || 0);

    const revealMinutes =
      (parseInt(revealDays) || 0) * 1440 +
      (parseInt(revealHrs) || 0) * 60 +
      (parseInt(revealMins) || 0);

    if (votingMinutes < 1) {
      setError('Voting phase must last at least 1 minute');
      return;
    }

    if (revealMinutes < 1) {
      setError('Reveal phase must last at least 1 minute');
      return;
    }

    if (votingMinutes > 43200) {
      setError('Voting phase cannot exceed 30 days');
      return;
    }

    if (revealMinutes > 43200) {
      setError('Reveal phase cannot exceed 30 days');
      return;
    }

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
      const commitHashBytes = generateCommitHash(
        address,
        myVote,
        secret
      );

      const hashHex = Array.from(
        commitHashBytes,
        (b) => b.toString(16).padStart(2, '0')
      ).join('');

      const stakeInMist = BigInt(
        Math.floor(stake * 1_000_000_000)
      );

      const commitMs = BigInt(votingMinutes * 60 * 1000);
      const revealMs = BigInt(revealMinutes * 60 * 1000);

      const pendingKey = `fossil_pending_${address}`;

      localStorage.setItem(
        pendingKey,
        JSON.stringify({
          vote: myVote,
          secret,
          hashHex,
          address,
          timestamp: Date.now(),
        })
      );

      const { digest } = await submitEvent(
        description,
        context,
        category,
        stakeInMist,
        commitMs,
        revealMs,
        commitHashBytes
      );

      setSubmitStatus('indexing');

      const eventId = await waitForEventId(digest);

      if (eventId) {
        localStorage.setItem(
          `fossil_commit_${eventId}_${address}`,
          JSON.stringify({
            eventId,
            vote: myVote,
            secret,
            hashHex,
            address,
            digest,
            timestamp: Date.now(),
          })
        );

        localStorage.removeItem(pendingKey);
        onSuccess?.(eventId);
      } else {
        setSuccessDigest(digest);
      }
    } catch (err) {
      let errorMessage = 'Transaction failed';

      if (err instanceof Error) {
        if (
          err.message.includes('insufficient funds') ||
          err.message.includes('InsufficientCoinBalance')
        ) {
          errorMessage =
            `Insufficient SUI balance. You need at least ${stake} SUI.`;
        } else if (
          err.message.includes('rejected') ||
          err.message.includes('User rejected')
        ) {
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

  if (successDigest) {
    return (
      <section className="border-t border-[var(--border)] py-10">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          Submitted
        </div>

        <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Claim recorded
        </h2>

        <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
          The transaction was confirmed on-chain. The claim may take a
          moment to appear in the public record.
        </p>

        <p className="mt-6 max-w-xl break-all font-mono text-[9px] leading-relaxed text-[var(--subtle)]">
          {successDigest}
        </p>

        <a
          href="/active"
          className="inline-block mt-7 text-sm font-medium text-[var(--foreground)] underline underline-offset-4"
        >
          View active claims
        </a>
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="border-t border-[var(--border)] py-12">
        <p className="text-sm text-[var(--muted)]">
          Join the consensus to propose a claim.
        </p>
      </section>
    );
  }

  if (showConfirmation) {
    return (
      <section className="border-t border-[var(--border)] py-10">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          Confirmation
        </div>

        <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Review your claim
        </h2>

        <div className="mt-8 border-y border-[var(--border)] divide-y divide-[var(--border)]">
          <div className="grid grid-cols-[110px_1fr] gap-6 py-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--subtle)]">
              Claim
            </span>

            <span className="text-sm leading-relaxed text-[var(--foreground)]">
              {description}
            </span>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-6 py-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--subtle)]">
              Vote
            </span>

            <span className="text-sm text-[var(--foreground)]">
              {myVote ? 'YES · True' : 'NO · False'}
            </span>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-6 py-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--subtle)]">
              Stake
            </span>

            <span className="text-sm text-[var(--foreground)]">
              {stake} SUI
            </span>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-[var(--subtle)]">
          This action cannot be undone. You will need to reveal your
          committed vote during the reveal phase.
        </p>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowConfirmation(false)}
            className="px-5 py-2.5 text-sm text-[var(--foreground)] border border-[var(--border-strong)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-raised)]"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="px-5 py-2.5 text-sm font-medium bg-[var(--foreground)] text-[var(--background)] rounded-[var(--radius-sm)] disabled:opacity-40"
          >
            {isSubmitting ? 'Submitting…' : 'Confirm & submit'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* Category */}
      <section className="border-t border-[var(--border)] py-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          01 · Category
        </div>

        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(CATEGORY_INDEX[cat])}
              className={`text-[10px] uppercase tracking-[0.1em] transition-colors ${
                category === i
                  ? 'text-[var(--foreground)] underline underline-offset-4'
                  : 'text-[var(--subtle)] hover:text-[var(--foreground)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Statement */}
      <section className="border-t border-[var(--border)] py-8">
        <label
          htmlFor="claim-statement"
          className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]"
        >
          02 · Claim statement
        </label>

        <textarea
          id="claim-statement"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="State one clear, verifiable claim."
          rows={4}
          maxLength={290}
          className={`mt-5 w-full resize-none bg-transparent border rounded-[var(--radius-sm)] px-4 py-4 text-[16px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--subtle)] outline-none ${
            description.length > 280
              ? 'border-[var(--no-light)]'
              : 'border-[var(--border)] focus:border-[var(--border-strong)]'
          }`}
        />

        <div className="mt-2 flex justify-end">
          <span
            className={`font-mono text-[9px] ${
              description.length > 280
                ? 'text-[var(--no-light)]'
                : 'text-[var(--subtle)]'
            }`}
          >
            {description.length}/280
          </span>
        </div>
      </section>

      {/* Context */}
      <section className="border-t border-[var(--border)] py-8">
        <label
          htmlFor="claim-context"
          className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]"
        >
          03 · Context
          <span className="ml-2 normal-case tracking-normal">
            optional
          </span>
        </label>

        <p className="mt-3 text-xs leading-relaxed text-[var(--subtle)]">
          Add sources or background that can help participants evaluate
          the statement.
        </p>

        <textarea
          id="claim-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Sources, references or useful context…"
          rows={4}
          maxLength={500}
          className="mt-5 w-full resize-none bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] px-4 py-4 text-sm leading-relaxed text-[var(--foreground)] placeholder:text-[var(--subtle)] outline-none focus:border-[var(--border-strong)]"
        />

        <div className="mt-2 flex justify-end">
          <span className="font-mono text-[9px] text-[var(--subtle)]">
            {context.length}/500
          </span>
        </div>
      </section>

      {/* Parameters */}
      <section className="border-t border-[var(--border)] py-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          04 · Parameters
        </div>

        <div className="mt-7 space-y-8">

          <div>
            <label className="block text-[13px] font-medium text-[var(--foreground)]">
              Stake
            </label>

            <div className="mt-3 max-w-xs">
              <div className="relative">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className={`w-full h-11 bg-transparent border rounded-[var(--radius-sm)] px-3 pr-14 text-sm text-[var(--foreground)] outline-none ${
                    stakeError
                      ? 'border-[var(--no-light)]'
                      : 'border-[var(--border)] focus:border-[var(--border-strong)]'
                  }`}
                />

                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[var(--subtle)]">
                  SUI
                </span>
              </div>

              <p
                className={`mt-2 text-[11px] ${
                  stakeError
                    ? 'text-[var(--no-light)]'
                    : 'text-[var(--subtle)]'
                }`}
              >
                {stakeError || 'Minimum 0.01 SUI'}
              </p>
            </div>
          </div>

          {(['Voting', 'Reveal'] as const).map((label) => {
            const days =
              label === 'Voting' ? votingDays : revealDays;

            const hrs =
              label === 'Voting' ? votingHrs : revealHrs;

            const mins =
              label === 'Voting' ? votingMins : revealMins;

            const setD =
              label === 'Voting'
                ? setVotingDays
                : setRevealDays;

            const setH =
              label === 'Voting'
                ? setVotingHrs
                : setRevealHrs;

            const setM =
              label === 'Voting'
                ? setVotingMins
                : setRevealMins;

            return (
              <div key={label}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[var(--foreground)]">
                    {label} phase
                  </span>

                  <span className="text-[10px] text-[var(--subtle)]">
                    max 30 days
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 max-w-xl">
                  {[
                    {
                      val: days,
                      set: setD,
                      max: 30,
                      suffix: 'd',
                    },
                    {
                      val: hrs,
                      set: setH,
                      max: 23,
                      suffix: 'h',
                    },
                    {
                      val: mins,
                      set: setM,
                      max: 59,
                      suffix: 'm',
                    },
                  ].map(({ val, set, max, suffix }) => (
                    <div key={suffix} className="relative">
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        min="0"
                        max={max}
                        className="w-full h-11 bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] pl-3 pr-9 text-sm text-[var(--foreground)] outline-none focus:border-[var(--border-strong)]"
                      />

                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[var(--subtle)]">
                        {suffix}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Vote */}
      <section className="border-t border-[var(--border)] py-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          05 · Initial vote
        </div>

        <p className="mt-3 max-w-lg text-xs leading-relaxed text-[var(--subtle)]">
          The proposer also participates in the consensus and commits the
          first vote.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 max-w-xl">
          <button
            type="button"
            onClick={() => setMyVote(true)}
            className={`h-12 border rounded-[var(--radius-sm)] text-sm font-medium transition-colors ${
              myVote
                ? 'border-[var(--foreground)] text-[var(--foreground)] bg-[var(--surface-raised)]'
                : 'border-[var(--border)] text-[var(--subtle)] hover:text-[var(--foreground)]'
            }`}
          >
            True
          </button>

          <button
            type="button"
            onClick={() => setMyVote(false)}
            className={`h-12 border rounded-[var(--radius-sm)] text-sm font-medium transition-colors ${
              !myVote
                ? 'border-[var(--foreground)] text-[var(--foreground)] bg-[var(--surface-raised)]'
                : 'border-[var(--border)] text-[var(--subtle)] hover:text-[var(--foreground)]'
            }`}
          >
            False
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="border-t border-[var(--border)] py-5">
          <p className="text-sm text-[var(--no-light)]">
            {error}
          </p>
        </div>
      )}

      {/* Submit */}
      <section className="border-t border-[var(--border)] pt-8 pb-14">
        <button
          type="submit"
          disabled={!description || !!stakeError || isSubmitting}
          className="h-12 px-6 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium rounded-[var(--radius-sm)] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
        >
          {submitStatus === 'signing'
            ? 'Waiting for signature…'
            : submitStatus === 'indexing'
              ? 'Confirming on-chain…'
              : `Propose claim · ${stake.toFixed(2)} SUI`}
        </button>

        <p className="mt-4 max-w-lg text-[11px] leading-relaxed text-[var(--subtle)]">
          After voting closes, your committed vote must be revealed during
          the reveal phase.
        </p>
      </section>
    </form>
  );
}
