'use client';

import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// ========================
// Module-level sign function
// Set by WalletContext when a wallet is connected.
// ========================

let _signAndExecuteFn: ((tx: Transaction) => Promise<{ digest: string }>) | null = null;

export function setSignAndExecuteFunction(
  fn: ((tx: Transaction) => Promise<{ digest: string }>) | null
): void {
  _signAndExecuteFn = fn;
}

export function isWalletInstalled(): boolean {
  // With dapp-kit, wallets are discovered dynamically — always return true
  return true;
}

export async function connectWallet(): Promise<{ address: string }> {
  // Handled by WalletContext / dapp-kit
  throw new Error('Use WalletContext.connect()');
}

export async function getAccount(): Promise<{ address: string } | null> {
  // Handled by dapp-kit useCurrentAccount
  return null;
}

export async function disconnectWallet(): Promise<void> {
  // Handled by WalletContext / dapp-kit
}

// ========================
// SUI Client
// ========================

let _client: SuiGrpcClient | null = null;

export function getSuiClient(): SuiGrpcClient {
  if (!_client) {
    _client = new SuiGrpcClient({
      network: 'testnet',
      baseUrl: 'https://fullnode.testnet.sui.io:443',
    });
  }

  return _client;
}

// ========================
// Transaction helpers
// ========================

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';
const FOSSIL_ID = process.env.NEXT_PUBLIC_FOSSIL_ID || '';

async function signAndExecute(tx: Transaction): Promise<{ digest: string }> {
  if (!_signAndExecuteFn) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }
  const result = await _signAndExecuteFn(tx);

  // Verify on-chain status — Sui includes failed txs in the chain with a digest
  try {
    const client = getSuiClient();
    const txResult = await client.getTransaction({
      digest: result.digest,
      include: { effects: true },
    });

    const tx = txResult.Transaction ?? txResult.FailedTransaction;

    if (!tx.status.success) {
      const reason = tx.status.error?.message ?? 'Unknown error';
      if (reason.includes('InsufficientCoinBalance') || reason.includes('InsufficientGas')) {
        throw new Error('Insufficient SUI balance. Get testnet SUI from the faucet.');
      }
      // Parse Move abort codes — Sui returns numeric codes, not names
      const abortMatch = reason.match(/MoveAbort\([^,]+,\s*(\d+)\)/);
      if (abortMatch) {
        const code = parseInt(abortMatch[1]);
        const ABORT_MESSAGES: Record<number, string> = {
          0:  'Description is too long (max 280 characters).',
          1:  'Stake amount is too low (minimum 0.01 SUI).',
          2:  'Phase duration exceeds maximum (1 month per phase).',
          3:  'Phase duration is too short (minimum 1 minute).',
          4:  'Wrong stake amount sent.',
          5:  'Action not allowed in the current phase.',
          6:  'You have already voted on this claim.',
          7:  'Claim not found.',
          8:  'You have already revealed your vote.',
          9:  'Hash mismatch — your secret or vote does not match your commitment.',
          10: 'This claim has already been resolved.',
          11: 'The reveal phase is not over yet.',
          12: 'Invalid commit hash length (must be 32 bytes).',
          13: 'Invalid category.',
          14: 'Context is too long (max 500 characters).',
          15: 'You have already claimed your reward.',
          16: 'You are not eligible to claim a reward on this claim.',
        };
        throw new Error(ABORT_MESSAGES[code] ?? `Contract error (code ${code}).`);
      }
      throw new Error(`Transaction failed: ${reason}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Transaction failed') ||
        err instanceof Error && err.message.startsWith('Insufficient')) {
      throw err;
    }
    // If status check fails (network issue), let it proceed
  }

  return result;
}

export async function submitEvent(
  description: string,
  context: string,
  category: number,
  stakeAmountMist: bigint,
  commitDurationMs: bigint,
  revealDurationMs: bigint,
  commitHash: Uint8Array
): Promise<{ digest: string }> {
  const tx = new Transaction();
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(stakeAmountMist)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::fossil::submit`,
    arguments: [
      tx.object(FOSSIL_ID),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(description))),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(context))),
      tx.pure.u8(category),
      stakeCoin,
      tx.pure.u64(stakeAmountMist),
      tx.pure.u64(commitDurationMs),
      tx.pure.u64(revealDurationMs),
      tx.pure.vector('u8', Array.from(commitHash)),
      tx.object('0x6'),
    ],
  });
  return signAndExecute(tx);
}

export async function commitVote(
  eventId: bigint,
  commitHash: Uint8Array,
  stakeAmountMist: bigint
): Promise<{ digest: string }> {
  const tx = new Transaction();
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(stakeAmountMist)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::fossil::commit_vote`,
    arguments: [
      tx.object(FOSSIL_ID),
      tx.pure.u64(eventId),
      tx.pure.vector('u8', Array.from(commitHash)),
      stakeCoin,
      tx.object('0x6'),
    ],
  });
  return signAndExecute(tx);
}

export async function revealVote(
  eventId: bigint,
  vote: boolean,
  secret: string
): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::fossil::reveal_vote`,
    arguments: [
      tx.object(FOSSIL_ID),
      tx.pure.u64(eventId),
      tx.pure.bool(vote),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(secret))),
      tx.object('0x6'),
    ],
  });
  return signAndExecute(tx);
}

export async function resolveEvent(eventId: bigint): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::fossil::resolve`,
    arguments: [
      tx.object(FOSSIL_ID),
      tx.pure.u64(eventId),
      tx.object('0x6'),
    ],
  });
  return signAndExecute(tx);
}

export async function claimReward(eventId: bigint): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::fossil::claim_reward`,
    arguments: [
      tx.object(FOSSIL_ID),
      tx.pure.u64(eventId),
    ],
  });
  return signAndExecute(tx);
}
