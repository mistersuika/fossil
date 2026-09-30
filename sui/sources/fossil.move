/// HISTORIA: Decentralized Ledger of Collective Memory
/// Commit-reveal blind voting with stake redistribution.
/// One wallet, one vote. Truth is verified, not dictated.
module fossil::fossil {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::hash;
    use std::string::{Self, String};
    use std::vector;
    use std::bcs;

    // ========================
    // Constants
    // ========================

    const STATUS_COMMIT: u8   = 0;
    const STATUS_REVEAL: u8   = 1;
    const STATUS_RESOLVED: u8 = 2;
    const STATUS_VOIDED: u8   = 3;

    const OUTCOME_AGAINST: u8 = 0;
    const OUTCOME_FOR: u8     = 1;
    const OUTCOME_TIE: u8     = 2;
    const OUTCOME_PENDING: u8 = 3;

    /// 0.01 SUI minimum stake to propose a claim — test mode
    const MIN_PROPOSE_MIST: u64   = 10_000_000;
    const MAX_DESC_LEN: u64       = 280;
    const MAX_CONTEXT_LEN: u64    = 500;
    /// 30 days in milliseconds — maximum per phase
    const MAX_PHASE_MS: u64       = 2_592_000_000;
    /// 1 minute in milliseconds
    const MIN_PHASE_MS: u64       = 60_000;

    // Categories
    const CAT_SCIENCE: u8     = 0;
    const CAT_ECONOMICS: u8   = 1;
    const CAT_POLITICS: u8    = 2;
    const CAT_SOCIETY: u8     = 3;
    const CAT_TECHNOLOGY: u8  = 4;

    // ========================
    // Error codes
    // ========================

    const EDescTooLong: u64        = 0;
    const EStakeTooLow: u64        = 1;
    const EDurationExceeded: u64   = 2;
    const EPhaseTooShort: u64      = 3;
    const EWrongStake: u64         = 4;
    const EWrongPhase: u64         = 5;
    const EAlreadyCommitted: u64   = 6;
    const ENotFound: u64           = 7;
    const EAlreadyRevealed: u64    = 8;
    const EHashMismatch: u64       = 9;
    const EAlreadyFinalized: u64   = 10;
    const ERevealNotEnded: u64     = 11;
    const EInvalidHashLen: u64     = 12;
    const EInvalidCategory: u64    = 13;
    const EContextTooLong: u64     = 14;
    const EAlreadyClaimed: u64     = 15;
    const ENotEligible: u64        = 16;

    // ========================
    // Data structures
    // ========================

    /// Composite key for a voter's commit on a given claim
    public struct CommitKey has copy, drop, store {
        event_id: u64,
        voter: address,
    }

    /// A sealed ballot
    public struct CommitRecord has store {
        /// SHA2-256( bcs(address) || vote_byte || secret_bytes )
        hash_bytes: vector<u8>,
        revealed: bool,
        vote: bool,
    }

    /// A historical claim submitted for collective consensus
    public struct EventRecord has store {
        description: String,
        context: String,
        category: u8,
        proposer: address,
        /// Stake per voter in MIST
        stake_amount: u64,
        commit_end_ms: u64,
        reveal_end_ms: u64,
        status: u8,
        votes_for: u64,
        votes_against: u64,
        commits: u64,
        reveals: u64,
        outcome: u8,
        winning_vote: bool,
        /// Reward each winner can claim (computed at resolve time)
        reward_per_winner: u64,
        /// Accumulated stakes
        stake_pool: Balance<SUI>,
    }

    /// Main shared object — one per deployment
    public struct Fossil has key {
        id: UID,
        events: Table<u64, EventRecord>,
        commits: Table<CommitKey, CommitRecord>,
        /// Tracks which voters have claimed their reward
        rewards_claimed: Table<CommitKey, bool>,
        event_count: u64,
        founder: address,
    }

    // ========================
    // Emitted events (for frontend indexing)
    // ========================

    public struct EventCreated has copy, drop {
        event_id: u64,
        description: String,
        context: String,
        category: u8,
        proposer: address,
        stake_amount: u64,
        commit_end_ms: u64,
        reveal_end_ms: u64,
    }

    public struct VoteCommitted has copy, drop {
        event_id: u64,
        voter: address,
        total_commits: u64,
    }

    public struct VoteRevealed has copy, drop {
        event_id: u64,
        voter: address,
        vote: bool,
        votes_for: u64,
        votes_against: u64,
        total_reveals: u64,
    }

    public struct EventFinalized has copy, drop {
        event_id: u64,
        outcome: u8,
        votes_for: u64,
        votes_against: u64,
        reward_per_winner: u64,
    }

    public struct RewardClaimed has copy, drop {
        event_id: u64,
        voter: address,
        amount: u64,
    }

    // ========================
    // Init
    // ========================

    fun init(ctx: &mut TxContext) {
        transfer::share_object(Fossil {
            id: object::new(ctx),
            events: table::new(ctx),
            commits: table::new(ctx),
            rewards_claimed: table::new(ctx),
            event_count: 0,
            founder: tx_context::sender(ctx),
        });
    }

    // ========================
    // Core functions
    // ========================

    /// Submit a new claim. The proposer is the first voter.
    /// Minimum stake for proposing is 2 SUI (anti-spam).
    public entry fun submit(
        fossil: &mut Fossil,
        description: vector<u8>,
        context: vector<u8>,
        category: u8,
        mut stake_coin: Coin<SUI>,
        stake_amount: u64,
        commit_duration_ms: u64,
        reveal_duration_ms: u64,
        commit_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let desc = string::utf8(description);
        let ctx_str = string::utf8(context);
        assert!(string::length(&desc) <= MAX_DESC_LEN, EDescTooLong);
        assert!(string::length(&ctx_str) <= MAX_CONTEXT_LEN, EContextTooLong);
        assert!(category <= CAT_TECHNOLOGY, EInvalidCategory);
        assert!(stake_amount >= MIN_PROPOSE_MIST, EStakeTooLow);
        assert!(commit_duration_ms >= MIN_PHASE_MS, EPhaseTooShort);
        assert!(reveal_duration_ms >= MIN_PHASE_MS, EPhaseTooShort);
        assert!(commit_duration_ms <= MAX_PHASE_MS, EDurationExceeded);
        assert!(reveal_duration_ms <= MAX_PHASE_MS, EDurationExceeded);
        assert!(vector::length(&commit_hash) == 32, EInvalidHashLen);
        assert!(coin::value(&stake_coin) >= stake_amount, EWrongStake);

        let now = clock::timestamp_ms(clock);
        let commit_end_ms = now + commit_duration_ms;
        let reveal_end_ms = commit_end_ms + reveal_duration_ms;

        let event_id = fossil.event_count;
        fossil.event_count = event_id + 1;

        let sender = tx_context::sender(ctx);

        let stake = coin::split(&mut stake_coin, stake_amount, ctx);
        if (coin::value(&stake_coin) > 0) {
            transfer::public_transfer(stake_coin, sender);
        } else {
            coin::destroy_zero(stake_coin);
        };

        table::add(&mut fossil.events, event_id, EventRecord {
            description: desc,
            context: ctx_str,
            category,
            proposer: sender,
            stake_amount,
            commit_end_ms,
            reveal_end_ms,
            status: STATUS_COMMIT,
            votes_for: 0,
            votes_against: 0,
            commits: 1,
            reveals: 0,
            outcome: OUTCOME_PENDING,
            winning_vote: false,
            reward_per_winner: 0,
            stake_pool: coin::into_balance(stake),
        });

        table::add(&mut fossil.commits, CommitKey { event_id, voter: sender }, CommitRecord {
            hash_bytes: commit_hash,
            revealed: false,
            vote: false,
        });

        event::emit(EventCreated {
            event_id,
            description: desc,
            context: ctx_str,
            category,
            proposer: sender,
            stake_amount,
            commit_end_ms,
            reveal_end_ms,
        });
    }

    /// Register a sealed vote during the voting phase.
    public entry fun commit_vote(
        fossil: &mut Fossil,
        event_id: u64,
        commit_hash: vector<u8>,
        mut stake_coin: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&fossil.events, event_id), ENotFound);
        assert!(vector::length(&commit_hash) == 32, EInvalidHashLen);

        let now = clock::timestamp_ms(clock);
        let sender = tx_context::sender(ctx);
        let commit_key = CommitKey { event_id, voter: sender };

        assert!(!table::contains(&fossil.commits, commit_key), EAlreadyCommitted);

        let ev = table::borrow_mut(&mut fossil.events, event_id);
        assert!(ev.status == STATUS_COMMIT, EWrongPhase);
        assert!(now < ev.commit_end_ms, EWrongPhase);
        assert!(coin::value(&stake_coin) >= ev.stake_amount, EWrongStake);

        let stake_amount = ev.stake_amount;
        let stake = coin::split(&mut stake_coin, stake_amount, ctx);
        if (coin::value(&stake_coin) > 0) {
            transfer::public_transfer(stake_coin, sender);
        } else {
            coin::destroy_zero(stake_coin);
        };

        balance::join(&mut ev.stake_pool, coin::into_balance(stake));
        ev.commits = ev.commits + 1;
        let total_commits = ev.commits;

        table::add(&mut fossil.commits, commit_key, CommitRecord {
            hash_bytes: commit_hash,
            revealed: false,
            vote: false,
        });

        event::emit(VoteCommitted { event_id, voter: sender, total_commits });
    }

    /// Reveal a previously committed vote.
    public entry fun reveal_vote(
        fossil: &mut Fossil,
        event_id: u64,
        vote: bool,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&fossil.events, event_id), ENotFound);

        let now = clock::timestamp_ms(clock);
        let sender = tx_context::sender(ctx);

        {
            let ev = table::borrow_mut(&mut fossil.events, event_id);
            if (ev.status == STATUS_COMMIT && now >= ev.commit_end_ms) {
                ev.status = STATUS_REVEAL;
            };
            assert!(ev.status == STATUS_REVEAL, EWrongPhase);
            assert!(now < ev.reveal_end_ms, EWrongPhase);
        };

        let commit_key = CommitKey { event_id, voter: sender };
        assert!(table::contains(&fossil.commits, commit_key), ENotFound);

        {
            let commit = table::borrow(&fossil.commits, commit_key);
            assert!(!commit.revealed, EAlreadyRevealed);

            let mut preimage = bcs::to_bytes(&sender);
            vector::push_back(&mut preimage, if (vote) { 1u8 } else { 0u8 });
            vector::append(&mut preimage, secret);

            let computed = hash::sha2_256(preimage);
            assert!(computed == commit.hash_bytes, EHashMismatch);
        };

        {
            let commit = table::borrow_mut(&mut fossil.commits, commit_key);
            commit.revealed = true;
            commit.vote = vote;
        };

        let (votes_for, votes_against, total_reveals) = {
            let ev = table::borrow_mut(&mut fossil.events, event_id);
            ev.reveals = ev.reveals + 1;
            if (vote) { ev.votes_for = ev.votes_for + 1 }
            else      { ev.votes_against = ev.votes_against + 1 };
            (ev.votes_for, ev.votes_against, ev.reveals)
        };

        event::emit(VoteRevealed { event_id, voter: sender, vote, votes_for, votes_against, total_reveals });
    }

    /// Finalize a claim after the reveal deadline. Anyone can call this.
    ///
    /// Fossil V1 economics:
    /// - FOR majority: revealed FOR voters win
    /// - AGAINST majority: revealed AGAINST voters win
    /// - TIE: every revealer is considered a winner
    /// - Non-revealers are always losers
    /// - 3% of the losers pool goes to the proposer
    /// - 97% of the losers pool is shared equally by winners
    /// - If nobody reveals, the entire pool goes to the proposer
    ///
    /// Resolution is O(1): it never loops over all voters.
    public entry fun resolve(
        fossil: &mut Fossil,
        event_id: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&fossil.events, event_id), ENotFound);

        let now = clock::timestamp_ms(clock);

        let (
            status,
            commits,
            reveals,
            votes_for,
            votes_against,
            reveal_end_ms,
            proposer,
            stake_amount
        ) = {
            let ev = table::borrow(&fossil.events, event_id);
            (
                ev.status,
                ev.commits,
                ev.reveals,
                ev.votes_for,
                ev.votes_against,
                ev.reveal_end_ms,
                ev.proposer,
                ev.stake_amount
            )
        };

        assert!(now >= reveal_end_ms, ERevealNotEnded);
        assert!(
            status != STATUS_RESOLVED && status != STATUS_VOIDED,
            EAlreadyFinalized
        );

        // Nobody revealed: nobody can win.
        // The entire pool goes to the proposer.
        if (reveals == 0) {
            let ev = table::borrow_mut(&mut fossil.events, event_id);
            ev.status = STATUS_VOIDED;
            ev.outcome = OUTCOME_PENDING;
            ev.reward_per_winner = 0;

            let pool_amount = balance::value(&ev.stake_pool);
            if (pool_amount > 0) {
                let payout = coin::from_balance(
                    balance::split(&mut ev.stake_pool, pool_amount),
                    ctx
                );
                transfer::public_transfer(payout, proposer);
            };

            event::emit(EventFinalized {
                event_id,
                outcome: OUTCOME_PENDING,
                votes_for,
                votes_against,
                reward_per_winner: 0,
            });
            return
        };

        let outcome =
            if (votes_for > votes_against) {
                OUTCOME_FOR
            } else if (votes_against > votes_for) {
                OUTCOME_AGAINST
            } else {
                OUTCOME_TIE
            };

        // No iteration over voters is needed:
        // - majority: winners are the majority revealers
        // - tie: all revealers are winners
        let n_winners =
            if (outcome == OUTCOME_FOR) {
                votes_for
            } else if (outcome == OUTCOME_AGAINST) {
                votes_against
            } else {
                reveals
            };

        let n_losers = commits - n_winners;
        let losers_pool = n_losers * stake_amount;

        // 3% proposer fee.
        // The remaining 97% is shared by winners.
        let base_proposer_fee = (losers_pool * 3) / 100;
        let distributable = losers_pool - base_proposer_fee;

        let reward_per_winner =
            if (n_winners > 0) {
                distributable / n_winners
            } else {
                0
            };

        // Integer division may leave a few MIST undistributed.
        // Give this rounding dust to the proposer so no funds remain stuck.
        let distributed_rewards = reward_per_winner * n_winners;
        let rounding_dust = distributable - distributed_rewards;
        let proposer_payout = base_proposer_fee + rounding_dust;

        if (proposer_payout > 0) {
            let ev = table::borrow_mut(&mut fossil.events, event_id);
            let fee = coin::from_balance(
                balance::split(&mut ev.stake_pool, proposer_payout),
                ctx
            );
            transfer::public_transfer(fee, proposer);
        };

        {
            let ev = table::borrow_mut(&mut fossil.events, event_id);
            ev.status = STATUS_RESOLVED;
            ev.outcome = outcome;
            ev.winning_vote = outcome == OUTCOME_FOR;
            ev.reward_per_winner = reward_per_winner;
        };

        event::emit(EventFinalized {
            event_id,
            outcome,
            votes_for,
            votes_against,
            reward_per_winner,
        });
    }

    /// Claim reward after resolution. Each eligible voter calls once.
    /// - Majority winner: receives stake_amount + reward_per_winner
    /// - TIE: every revealer is a winner and receives stake_amount + reward_per_winner
    /// - Loser / non-revealer: no reward
    public entry fun claim_reward(
        fossil: &mut Fossil,
        event_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&fossil.events, event_id), ENotFound);

        let sender = tx_context::sender(ctx);
        let claim_key = CommitKey { event_id, voter: sender };

        assert!(!table::contains(&fossil.rewards_claimed, claim_key), EAlreadyClaimed);

        let (status, outcome, stake_amount, reward_per_winner, winning_vote) = {
            let ev = table::borrow(&fossil.events, event_id);
            (
                ev.status,
                ev.outcome,
                ev.stake_amount,
                ev.reward_per_winner,
                ev.winning_vote
            )
        };

        assert!(status == STATUS_RESOLVED, EWrongPhase);

        // Check eligibility
        let commit_key = CommitKey { event_id, voter: sender };
        assert!(table::contains(&fossil.commits, commit_key), ENotFound);

        let commit = table::borrow(&fossil.commits, commit_key);
        assert!(commit.revealed, ENotEligible);

        let eligible = if (outcome == OUTCOME_TIE) {
            true // In a tie, every revealer is considered a winner
        } else {
            commit.vote == winning_vote // voted with majority
        };

        assert!(eligible, ENotEligible);

        // Mark as claimed
        table::add(&mut fossil.rewards_claimed, claim_key, true);

        // Transfer: stake back + bonus
        let payout = stake_amount + reward_per_winner;
        let ev = table::borrow_mut(&mut fossil.events, event_id);
        let c = coin::from_balance(balance::split(&mut ev.stake_pool, payout), ctx);
        transfer::public_transfer(c, sender);

        event::emit(RewardClaimed { event_id, voter: sender, amount: payout });
    }

    // ========================
    // Read-only helpers
    // ========================

    public fun event_count(fossil: &Fossil): u64 {
        fossil.event_count
    }

    public fun get_event_status(fossil: &Fossil, event_id: u64): u8 {
        table::borrow(&fossil.events, event_id).status
    }

    public fun get_event_commits(fossil: &Fossil, event_id: u64): u64 {
        table::borrow(&fossil.events, event_id).commits
    }

    public fun has_committed(fossil: &Fossil, event_id: u64, voter: address): bool {
        table::contains(&fossil.commits, CommitKey { event_id, voter })
    }

    public fun has_revealed(fossil: &Fossil, event_id: u64, voter: address): bool {
        let ck = CommitKey { event_id, voter };
        if (!table::contains(&fossil.commits, ck)) { return false };
        table::borrow(&fossil.commits, ck).revealed
    }

    public fun has_claimed(fossil: &Fossil, event_id: u64, voter: address): bool {
        table::contains(&fossil.rewards_claimed, CommitKey { event_id, voter })
    }

    // ========================
    // Test-only helpers
    // ========================

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
