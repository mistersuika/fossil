// FOSSIL types — SUI version

export type ClaimStatus = 'VOTING' | 'REVEALING' | 'RESOLVED' | 'VOIDED';

export type Outcome = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'TIED';

export type Category = 'Science' | 'Economics' | 'Politics' | 'Society' | 'Technology';

export const CATEGORIES: Category[] = ['Science', 'Economics', 'Politics', 'Society', 'Technology'];

export const CATEGORY_INDEX: Record<Category, number> = {
  Science: 0,
  Economics: 1,
  Politics: 2,
  Society: 3,
  Technology: 4,
};

export const CATEGORY_FROM_INDEX: Record<number, Category> = {
  0: 'Science',
  1: 'Economics',
  2: 'Politics',
  3: 'Society',
  4: 'Technology',
};

export interface FossilClaim {
  id: string;
  description: string;
  context: string;
  category: Category;
  status: ClaimStatus;
  proposer: string;
  /** Creation timestamp in ms */
  createdAt?: number;
  /** Stake per voter in MIST (1 SUI = 1_000_000_000 MIST) */
  stakeAmount: number;
  version: number;
  parentId?: string;
  commits: number;
  reveals: number;
  votesFor?: number;
  votesAgainst?: number;
  outcome?: Outcome;
  /** Total pool in SUI (for display) */
  poolSui: number;
  /** Voting phase end timestamp (ms) */
  commitEnd?: number;
  /** Reveal phase end timestamp (ms) */
  revealEnd?: number;
  /** Reward per winner in MIST (available after resolution) */
  rewardPerWinner?: number;
  /** Resolution timestamp in ms (available after resolution) */
  resolvedAt?: number;
}

// Legacy alias for backwards compat during migration
export type FossilEvent = FossilClaim;

export interface WalletState {
  connected: boolean;
  address: string | null;
}

export interface CommitData {
  eventId: string;
  vote: boolean;
  secret: string;
  /** Hex representation of the 32-byte commit hash */
  hashHex: string;
  /** Address that made the commit — used to detect wallet account switches */
  address?: string;
}

export interface UserStats {
  totalVotes: number;
  wonVotes: number;
  totalReveals: number;
  /** Total staked in MIST */
  totalStaked: number;
  proposedClaims: number;
  winRate: number;
}
