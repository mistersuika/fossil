import { FossilEvent } from './types';

/**
 * Calcule un score de pertinence sur 10 pour un utilisateur
 * Basé sur 4 critères :
 * - Win Rate (% de votes corrects)
 * - Volume de votes
 * - Volume de GNOT staké
 * - Qualité des propositions
 */
export function calculateUserScore(
  winRate: number, // 0-100
  totalVotes: number,
  totalStaked: number, // en GNOT
  myProposals: FossilEvent[]
): number {
  // 1. Score du Win Rate (0-10)
  // 100% = 10 points, 0% = 0 points
  const winRateScore = (winRate / 100) * 10;

  // 2. Score du volume de votes (0-10)
  // 0 votes = 0 points
  // 10+ votes = 10 points
  const voteVolumeScore = Math.min(totalVotes, 10);

  // 3. Score du GNOT staké (0-10)
  // 0 GNOT = 0 points
  // 50+ GNOT = 10 points
  const stakeScore = Math.min((totalStaked / 50) * 10, 10);

  // 4. Score des propositions (0-10)
  let proposalScore = 5; // Score neutre par défaut si pas de propositions

  if (myProposals.length > 0) {
    const resolvedProposals = myProposals.filter(
      e => e.status === 'RESOLVED' || e.status === 'VOIDED'
    );

    if (resolvedProposals.length > 0) {
      const acceptedCount = resolvedProposals.filter(e => e.outcome === 'ACCEPTED').length;
      const rejectedCount = resolvedProposals.filter(e => e.outcome === 'REJECTED').length;
      const voidedCount = resolvedProposals.filter(e => e.status === 'VOIDED').length;

      // Accepté = bon (+1 point par événement, max 10)
      // Rejeté = mauvais (-0.5 point par événement)
      // Voided = très mauvais (-1 point par événement)
      const points = (acceptedCount * 1) - (rejectedCount * 0.5) - (voidedCount * 1);

      // Normaliser entre 0 et 10
      // Si tous acceptés : 10 points
      // Si tous rejetés : 0 points
      proposalScore = Math.max(0, Math.min(10, 5 + points));
    }
  }

  // Score final = moyenne des 4 critères
  const finalScore = (winRateScore + voteVolumeScore + stakeScore + proposalScore) / 4;

  // Arrondir à 1 décimale
  return Math.round(finalScore * 10) / 10;
}

/**
 * Retourne un label de qualité basé sur le score
 */
export function getScoreLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 8) {
    return { label: 'Excellent', color: 'text-green-600' };
  } else if (score >= 6) {
    return { label: 'Good', color: 'text-blue-600' };
  } else if (score >= 4) {
    return { label: 'Average', color: 'text-yellow-600' };
  } else if (score >= 2) {
    return { label: 'Poor', color: 'text-orange-600' };
  } else {
    return { label: 'Very Poor', color: 'text-red-600' };
  }
}
