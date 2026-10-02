'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { resolveEvent } from '@/lib/wallet';

interface ResolveButtonProps {
  eventId: string;
  revealEndTimestamp?: number;
  onSuccess?: () => void;
}

export function ResolveButton({
  eventId,
  onSuccess,
  revealEndTimestamp,
}: ResolveButtonProps) {
  const { connected, address } = useWallet();
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (revealEndTimestamp) {
      const diff = Date.now() - revealEndTimestamp;

      if (diff <= 0) {
        setError(
          `Confirmation phase not yet ended. Wait ${Math.ceil(
            -diff / 60000
          )} minute(s).`
        );
      }
    }
  }, [revealEndTimestamp]);

  const handleResolve = async () => {
    if (!connected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setIsResolving(true);
    setError(null);

    try {
      await resolveEvent(BigInt(eventId));
      onSuccess?.();
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Failed to resolve';

      let detailedError = errorMsg;

      if (errorMsg.includes('ERevealNotEnded')) {
        const timeLeft = revealEndTimestamp
          ? revealEndTimestamp - Date.now()
          : 0;

        detailedError =
          `Confirmation phase not yet ended. Wait ${Math.ceil(
            timeLeft / 60000
          )} more minute(s).`;
      } else if (errorMsg.includes('EAlreadyFinalized')) {
        detailedError = 'This claim has already been resolved.';
      }

      setError(detailedError);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="border-t border-[var(--border)] pt-8">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
        Resolution
      </div>

      <h3 className="mt-4 text-[21px] md:text-[23px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
        Ready to finalize
      </h3>

      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
        The reveal phase has ended. Finalize the result and distribute
        the pooled stakes.
      </p>

      {!connected && (
        <p className="mt-5 text-[12px] text-[var(--accent-hover)]">
          Connect your wallet to finalize this claim.
        </p>
      )}

      {error && (
        <div className="mt-6 max-w-2xl border-y border-[var(--no-border)] py-4 text-[13px] leading-relaxed text-[var(--no-light)]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleResolve}
        disabled={isResolving || !connected || !address}
        className="mt-7 h-12 px-6 bg-[var(--accent)] text-[var(--foreground)] text-[13px] font-medium rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isResolving
          ? 'Finalizing…'
          : !connected
            ? 'Connect wallet'
            : 'Finalize result'}
      </button>
    </div>
  );
}
