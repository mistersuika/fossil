'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { claimReward } from '@/lib/wallet';

interface ClaimRewardButtonProps {
  eventId: string;
  rewardPerWinner: number;
  stakeAmount: number;
  isTie?: boolean;
  onSuccess?: () => void;
}

export function ClaimRewardButton({
  eventId,
  rewardPerWinner,
  stakeAmount,
  isTie = false,
  onSuccess,
}: ClaimRewardButtonProps) {
  const { connected, address } = useWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const claimKey = `fossil_claimed_${eventId}_${address}`;

  const alreadyClaimed =
    typeof window !== 'undefined' &&
    !!localStorage.getItem(claimKey);

  const totalPayout =
    (stakeAmount + rewardPerWinner) / 1_000_000_000;

  const gain = rewardPerWinner / 1_000_000_000;

  if (!connected || !address) return null;

  if (claimed || alreadyClaimed) {
    return (
      <div className="border-t border-[var(--border)] pt-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
          Settlement
        </div>

        <p className="mt-4 text-[14px] font-medium text-[var(--foreground)]">
          Reward claimed
        </p>
      </div>
    );
  }

  const handleClaim = async () => {
    setIsClaiming(true);
    setError(null);

    try {
      await claimReward(BigInt(eventId));

      localStorage.setItem(claimKey, '1');
      setClaimed(true);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Transaction failed'
      );
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="border-t border-[var(--border)] pt-8">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--subtle)]">
        Settlement
      </div>

      <h3 className="mt-4 text-[21px] md:text-[23px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
        {isTie ? 'Stake return' : 'Claim reward'}
      </h3>

      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
        {isTie
          ? 'The result was tied. Your committed stake can be returned.'
          : 'Your revealed position was on the winning side.'}
      </p>

      <div className="mt-7 max-w-2xl border-y border-[var(--border)] divide-y divide-[var(--border)]">
        <div className="flex items-center justify-between py-4">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--subtle)]">
            Stake returned
          </span>

          <span className="text-[13px] text-[var(--foreground)]">
            {(stakeAmount / 1_000_000_000).toFixed(2)} SUI
          </span>
        </div>

        {!isTie && (
          <div className="flex items-center justify-between py-4">
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--subtle)]">
              Reward
            </span>

            <span className="text-[13px] text-[var(--foreground)]">
              +{gain.toFixed(3)} SUI
            </span>
          </div>
        )}

        <div className="flex items-center justify-between py-4">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--subtle)]">
            Total
          </span>

          <span className="text-[14px] font-semibold text-[var(--foreground)]">
            {totalPayout.toFixed(3)} SUI
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-6 max-w-2xl border-y border-[var(--no-border)] py-4 text-[13px] leading-relaxed text-[var(--no-light)]">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={isClaiming}
        onClick={handleClaim}
        className="mt-7 h-12 px-6 bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {isClaiming
          ? 'Claiming…'
          : `Claim ${totalPayout.toFixed(3)} SUI`}
      </button>
    </div>
  );
}
