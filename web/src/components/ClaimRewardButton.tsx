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

export function ClaimRewardButton({ eventId, rewardPerWinner, stakeAmount, isTie = false, onSuccess }: ClaimRewardButtonProps) {
  const { connected, address } = useWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const claimKey = `fossil_claimed_${eventId}_${address}`;
  const alreadyClaimed = typeof window !== 'undefined' && !!localStorage.getItem(claimKey);

  const totalPayout = (stakeAmount + rewardPerWinner) / 1_000_000_000;
  const gain = rewardPerWinner / 1_000_000_000;

  if (!connected || !address) return null;

  if (claimed || alreadyClaimed) {
    return (
      <div className="py-6 bg-[var(--yes-bg)] rounded-[var(--radius)] border border-[var(--yes-border)] text-center px-8">
        <p className="text-sm font-semibold text-[var(--yes)]">Reward claimed successfully</p>
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
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="bg-[var(--yes-bg)] rounded-[var(--radius)] border border-[var(--yes-border)] p-8 shadow-[var(--shadow)] animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[var(--yes)] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
          {isTie ? '🤝' : '🎉'}
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--yes)]">{isTie ? 'Draw' : 'You won!'}</h3>
          <p className="text-sm text-[var(--yes)] opacity-80">{isTie ? 'Your stake is being refunded' : 'You voted with the majority'}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 space-y-2.5 mb-6 border border-[var(--yes-border)]">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Your stake back</span>
          <span className="font-semibold text-[var(--foreground)]">{(stakeAmount / 1_000_000_000).toFixed(2)} SUI</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Winnings</span>
          <span className="font-semibold text-[var(--yes)]">+{gain.toFixed(3)} SUI</span>
        </div>
        <div className="flex justify-between text-sm pt-2.5 border-t border-[var(--yes-border)]">
          <span className="font-semibold text-[var(--foreground)]">Total</span>
          <span className="font-bold text-[var(--foreground)]">{totalPayout.toFixed(3)} SUI</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[var(--radius-btn)] bg-[var(--no-bg)] border border-[var(--no-border)] text-[var(--no)] text-sm font-medium mb-5">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={isClaiming}
        onClick={handleClaim}
        className="w-full py-3.5 bg-[var(--yes)] text-white font-bold text-sm rounded-[var(--radius-btn)] hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isClaiming ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Claiming...
          </>
        ) : `Claim ${totalPayout.toFixed(3)} SUI`}
      </button>
    </div>
  );
}
