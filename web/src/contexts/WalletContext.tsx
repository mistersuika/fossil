'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import {
  useCurrentAccount,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { setSignAndExecuteFunction } from '@/lib/wallet';

interface WalletContextType {
  connected: boolean;
  address: string | null;
  isLoading: boolean;
  error: string | null;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  isInstalled: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletBridge({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const connection = useWalletConnection();

  useEffect(() => {
    if (account) {
      setSignAndExecuteFunction(async (tx: Transaction) => {
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: tx,
        });

        if (result.FailedTransaction) {
          throw new Error(
            result.FailedTransaction.status.error?.message ??
              'Transaction failed',
          );
        }

        return {
          digest: result.Transaction.digest,
        };
      });
    } else {
      setSignAndExecuteFunction(null);
    }
  }, [account?.address, dAppKit]);

  const connect = async (walletName?: string) => {
    if (wallets.length === 0) return;

    const target = walletName
      ? wallets.find((wallet) => wallet.name === walletName)
      : wallets[0];

    if (!target) return;

    await dAppKit.connectWallet({ wallet: target });
  };

  const disconnect = async () => {
    await dAppKit.disconnectWallet();
  };

  return (
    <WalletContext.Provider
      value={{
        connected: !!account,
        address: account?.address ?? null,
        isLoading:
          connection.status === 'connecting' ||
          connection.status === 'reconnecting',
        error: null,
        connect,
        disconnect,
        isInstalled: wallets.length > 0,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return <WalletBridge>{children}</WalletBridge>;
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }

  return context;
}
