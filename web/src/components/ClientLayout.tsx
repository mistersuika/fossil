'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { WalletProvider } from '@/contexts/WalletContext';
import { dAppKit } from '@/lib/dapp-kit';
import { SplashScreen } from './SplashScreen';

const queryClient = new QueryClient();

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <WalletProvider>
          <SplashScreen />
          {children}
        </WalletProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
