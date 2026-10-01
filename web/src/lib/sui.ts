import { getSuiClient } from './wallet';
import { FossilClaim, ClaimStatus, Outcome, UserStats, CATEGORY_FROM_INDEX, Category } from './types';

const PACKAGE_ID   = process.env.NEXT_PUBLIC_PACKAGE_ID   || '';
const FOSSIL_ID  = process.env.NEXT_PUBLIC_FOSSIL_ID  || '';

// ========================
// On-chain event types
// ========================

interface EventCreatedFields {
  event_id: string;
  description: string;
  context: string;
  category: number;
  proposer: string;
  stake_amount: string;
  commit_end_ms: string;
  reveal_end_ms: string;
}

interface VoteCommittedFields {
  event_id: string;
  voter: string;
  total_commits: string;
}

interface VoteRevealedFields {
  event_id: string;
  voter: string;
  vote: boolean;
  votes_for: string;
  votes_against: string;
  total_reveals: string;
}

interface EventFinalizedFields {
  event_id: string;
  outcome: number;
  votes_for: string;
  votes_against: string;
  reward_per_winner: string;
}

// ========================
// Status helpers
// ========================

function resolveStatus(
  commitEndMs: number,
  revealEndMs: number,
  finalizedOutcome: number | undefined
): ClaimStatus {
  if (finalizedOutcome !== undefined) {
    return finalizedOutcome === 3 ? 'VOIDED' : 'RESOLVED';
  }
  const now = Date.now();
  if (now < commitEndMs)  return 'VOTING';
  if (now < revealEndMs)  return 'REVEALING';
  return 'REVEALING'; // after reveal end, unresolved — awaiting resolve() call
}

function outcomeFromU8(value: number): Outcome {
  switch (value) {
    case 0:  return 'REJECTED';
    case 1:  return 'ACCEPTED';
    case 2:  return 'TIED';
    default: return 'PENDING';
  }
}

// ========================
// Claims list query
// ========================

export async function fetchEvents(): Promise<FossilClaim[]> {
  const client = getSuiClient();
  const modulePrefix = `${PACKAGE_ID}::fossil`;

  const [created, committed, revealed, finalized] = await Promise.all([
    client.listEvents({
      filter: { eventType: `${modulePrefix}::EventCreated` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::VoteCommitted` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::VoteRevealed` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::EventFinalized` },
      limit: 50,
    }),
  ]);

  const commitsByEvent: Record<string, number> = {};
  for (const e of committed.events) {
    const f = e.json as unknown as VoteCommittedFields;
    const totalCommits = Number(f.total_commits);
    // Keep the highest total_commits (most recent state)
    if (!commitsByEvent[f.event_id] || totalCommits > commitsByEvent[f.event_id]) {
      commitsByEvent[f.event_id] = totalCommits;
    }
  }

  const revealsByEvent: Record<string, { votesFor: number; votesAgainst: number; reveals: number }> = {};
  for (const e of revealed.events) {
    const f = e.json as unknown as VoteRevealedFields;
    const existing = revealsByEvent[f.event_id];
    const totalReveals = Number(f.total_reveals);
    // Keep only the event with the highest total_reveals (the most recent state)
    if (!existing || totalReveals > existing.reveals) {
      revealsByEvent[f.event_id] = {
        votesFor: Number(f.votes_for),
        votesAgainst: Number(f.votes_against),
        reveals: totalReveals,
      };
    }
  }

  const finalizedByEvent: Record<string, EventFinalizedFields & { timestampMs?: number }> = {};
  for (const e of finalized.events) {
    const f = e.json as unknown as EventFinalizedFields;
    finalizedByEvent[f.event_id] = { ...f };
  }

  const claims: FossilClaim[] = created.events.map(e => {
    const f = e.json as unknown as EventCreatedFields;
    const id = f.event_id;
    const stakeAmount = Number(f.stake_amount);
    const commitEndMs = Number(f.commit_end_ms);
    const revealEndMs = Number(f.reveal_end_ms);
    const commits = commitsByEvent[id] ?? 1;
    const revealData = revealsByEvent[id];
    const fin = finalizedByEvent[id];

    const status = resolveStatus(commitEndMs, revealEndMs, fin ? fin.outcome : undefined);
    const outcome = fin ? outcomeFromU8(fin.outcome) : 'PENDING';
    const poolSui = (stakeAmount * commits) / 1_000_000_000;
    const category: Category = CATEGORY_FROM_INDEX[f.category ?? 0] ?? 'Science';

    return {
      id,
      description: f.description,
      context: f.context ?? '',
      category,
      status,
      proposer: f.proposer,
      stakeAmount,
      version: 1,
      commits,
      reveals: revealData?.reveals ?? 0,
      // For resolved claims, use EventFinalized vote counts (authoritative)
      // For active claims, use the latest VoteRevealed event
      votesFor: fin ? Number(fin.votes_for) : revealData?.votesFor,
      votesAgainst: fin ? Number(fin.votes_against) : revealData?.votesAgainst,
      outcome: status === 'RESOLVED' || status === 'VOIDED' ? outcome : undefined,
      poolSui,
      commitEnd: commitEndMs,
      revealEnd: revealEndMs,
      rewardPerWinner: fin ? Number(fin.reward_per_winner) : undefined,
      resolvedAt: fin?.timestampMs,
    };
  });

  claims.sort((a, b) => Number(b.id) - Number(a.id));
  return claims;
}

export async function fetchEvent(eventId: string): Promise<FossilClaim | null> {
  const all = await fetchEvents();
  return all.find(e => e.id === eventId) ?? null;
}

// ========================
// Stats
// ========================

export interface GlobalStats {
  uniqueVoters: number;
  totalClaims: number;
}

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const client = getSuiClient();
  const modulePrefix = `${PACKAGE_ID}::fossil`;

  const [committed, created] = await Promise.all([
    client.listEvents({
      filter: { eventType: `${modulePrefix}::VoteCommitted` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::EventCreated` },
      limit: 50,
    }),
  ]);

  const uniqueVoters = new Set(
    committed.events.map(e => (e.json as unknown as VoteCommittedFields).voter)
  ).size;

  return {
    uniqueVoters,
    totalClaims: created.events.length,
  };
}

export async function fetchUserStats(address: string): Promise<UserStats> {
  const client = getSuiClient();
  const modulePrefix = `${PACKAGE_ID}::fossil`;

  const [allCommits, allReveals, allFinalized, allCreated] = await Promise.all([
    client.listEvents({
      filter: { eventType: `${modulePrefix}::VoteCommitted` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::VoteRevealed` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::EventFinalized` },
      limit: 50,
    }),
    client.listEvents({
      filter: { eventType: `${modulePrefix}::EventCreated` },
      limit: 50,
    }),
  ]);

  const userCommits = allCommits.events.filter(
    e => (e.json as unknown as VoteCommittedFields).voter === address
  );

  const userReveals = allReveals.events.filter(
    e => (e.json as unknown as VoteRevealedFields).voter === address
  );

  const stakeByEvent: Record<string, number> = {};
  for (const e of allCreated.events) {
    const f = e.json as unknown as EventCreatedFields;
    stakeByEvent[f.event_id] = Number(f.stake_amount);
  }

  const finalizedMap: Record<string, EventFinalizedFields> = {};
  for (const e of allFinalized.events) {
    const f = e.json as unknown as EventFinalizedFields;
    finalizedMap[f.event_id] = f;
  }

  const totalVotes   = userCommits.length;
  const totalReveals = userReveals.length;
  const totalStaked  = userCommits.reduce((sum, e) => {
    const f = e.json as unknown as VoteCommittedFields;
    return sum + (stakeByEvent[f.event_id] ?? 0);
  }, 0);

  const proposedClaims = allCreated.events.filter(
    e => (e.json as unknown as EventCreatedFields).proposer === address
  ).length;

  let wonVotes = 0;
  for (const e of userReveals) {
    const f = e.json as unknown as VoteRevealedFields;
    const fin = finalizedMap[f.event_id];
    if (!fin || fin.outcome === 2 || fin.outcome === 3) continue;
    const winVote = fin.outcome === 1;
    if (f.vote === winVote) wonVotes++;
  }

  const winRate = totalReveals > 0 ? Math.round((wonVotes * 100) / totalReveals) : 0;

  return { totalVotes, wonVotes, totalReveals, totalStaked, proposedClaims, winRate };
}

/**
 * Extract the event_id from an EventCreated emitted in a transaction.
 * Used after submitEvent() to know where to redirect.
 */
export async function getEventIdFromDigest(digest: string): Promise<string | null> {
  const client = getSuiClient();
  const modulePrefix = `${PACKAGE_ID}::fossil`;
  try {
    const result = await client.getTransaction({
      digest,
      include: { events: true },
    });

    const tx = result.Transaction ?? result.FailedTransaction;

    const event = tx.events?.find(
      e => e.eventType === `${modulePrefix}::EventCreated`
    );

    if (!event) return null;

    const fields = event.json as unknown as EventCreatedFields;
    return fields.event_id ?? null;
  } catch {
    return null;
  }
}

export async function hasCommitted(eventId: string, address: string): Promise<boolean> {
  const client = getSuiClient();
  const modulePrefix = `${PACKAGE_ID}::fossil`;
  const result = await client.listEvents({
    filter: { eventType: `${modulePrefix}::VoteCommitted` },
    limit: 50,
  });
  return result.events.some(e => {
    const f = e.json as unknown as VoteCommittedFields;
    return f.event_id === eventId && f.voter === address;
  });
}

export async function hasRevealed(eventId: string, address: string): Promise<boolean> {
  const client = getSuiClient();
  const modulePrefix = `${PACKAGE_ID}::fossil`;
  const result = await client.listEvents({
    filter: { eventType: `${modulePrefix}::VoteRevealed` },
    limit: 50,
  });
  return result.events.some(e => {
    const f = e.json as unknown as VoteRevealedFields;
    return f.event_id === eventId && f.voter === address;
  });
}

export { FOSSIL_ID, PACKAGE_ID };
