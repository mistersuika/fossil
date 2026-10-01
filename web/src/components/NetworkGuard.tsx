'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useWallet } from '@/contexts/WalletContext';

const EXPECTED_CHAIN = 'sui:testnet';

export function NetworkGuard() {
  const { connected } = useWallet();
  const account = useCurrentAccount();

  if (!connected || !account) return null;

  // WalletAccount has a `chains` array — check if testnet is included
  const chains: string[] = (account as unknown as { chains?: string[] }).chains ?? [];
  const isWrongNetwork = chains.length > 0 && !chains.includes(EXPECTED_CHAIN);

  if (!isWrongNetwork) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center gap-3 text-sm">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="text-amber-800 font-medium">
          Wrong network — FOSSIL runs on <strong>Sui Testnet</strong>.
          Switch your wallet to Testnet to submit transactions.
        </span>
      </div>
    </div>
  );
}
