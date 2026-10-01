'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDAppKit, useWalletConnection, useWallets } from '@mysten/dapp-kit-react';
import { useWallet } from '@/contexts/WalletContext';

export function WalletConnect() {
  const { connected, address, isLoading, disconnect } = useWallet();
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const connection = useWalletConnection();
  const isPending =
    connection.status === 'connecting' ||
    connection.status === 'reconnecting';
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectWallet = async (walletName: string) => {
    const wallet = wallets.find(w => w.name === walletName);
    if (!wallet) return;
    setError(null);
    try {
      await dAppKit.connectWallet({ wallet });
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--yes-light)] flex-shrink-0" />
          <span className="font-mono text-[var(--foreground)]">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] rounded-full hover:bg-[var(--surface-raised)] transition-all"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isLoading || isPending}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[var(--shadow-sm)]"
      >
        {isLoading || isPending ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          'Connect Wallet'
        )}
      </button>

      {showModal && (
        <WalletModal
          wallets={wallets}
          onSelect={handleSelectWallet}
          onClose={() => { setShowModal(false); setError(null); }}
          error={error}
          isPending={isPending}
        />
      )}
    </>
  );
}

interface WalletInfo {
  name: string;
  icon?: string;
}

function WalletModal({
  wallets,
  onSelect,
  onClose,
  error,
  isPending,
}: {
  wallets: WalletInfo[];
  onSelect: (name: string) => void;
  onClose: () => void;
  error: string | null;
  isPending: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  // Well-known wallets to suggest if not installed
  const suggestedWallets = [
    { name: 'Phantom', url: 'https://phantom.app' },
    { name: 'Sui Wallet', url: 'https://suiwallet.com' },
    { name: 'Suiet', url: 'https://suiet.app' },
  ];

  const installedNames = new Set(wallets.map(w => w.name));
  const notInstalled = suggestedWallets.filter(w => !installedNames.has(w.name));

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-md)] w-full max-w-sm p-6 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Connect Wallet</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">Choose a wallet to continue</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--surface-raised)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Installed wallets */}
        {wallets.length > 0 ? (
          <div className="space-y-2 mb-4">
            {wallets.map(wallet => (
              <button
                key={wallet.name}
                onClick={() => onSelect(wallet.name)}
                disabled={isPending}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] transition-all text-left disabled:opacity-50"
              >
                {wallet.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-raised)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">{wallet.name}</p>
                  <p className="text-xs text-[var(--yes-light)]">Detected</p>
                </div>
                {isPending && (
                  <span className="w-4 h-4 border-2 border-[var(--border-strong)] border-t-[var(--foreground)] rounded-full animate-spin flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center mb-4">
            <p className="text-sm text-[var(--muted)]">No wallet detected</p>
            <p className="text-xs text-[var(--subtle)] mt-1">Install one of the wallets below</p>
          </div>
        )}

        {/* Not installed wallets */}
        {notInstalled.length > 0 && (
          <div>
            <p className="text-xs text-[var(--subtle)] uppercase tracking-wide font-medium mb-2">
              {wallets.length > 0 ? 'Get more wallets' : 'Install a wallet'}
            </p>
            <div className="space-y-1.5">
              {notInstalled.map(wallet => (
                <a
                  key={wallet.name}
                  href={wallet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius)] hover:bg-[var(--surface-raised)] transition-all text-left group"
                >
                  <div className="w-7 h-7 rounded-md bg-[var(--surface-raised)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-[var(--subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors flex-1">{wallet.name}</span>
                  <svg className="w-3.5 h-3.5 text-[var(--subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-4 text-xs text-[var(--no-light)] font-medium text-center">{error}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
