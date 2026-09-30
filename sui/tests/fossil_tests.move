#[test_only]
module fossil::fossil_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock;
    use sui::coin;
    use sui::sui::SUI;
    use std::hash;
    use std::bcs;
    use std::vector;
    use fossil::fossil::{Self, Fossil};

    // ========================
    // Test addresses
    // ========================

    const ADMIN: address = @0xAD;
    const ALICE: address = @0xA1;
    const BOB:   address = @0xB0;
    const CAROL: address = @0xC0;

    // ========================
    // Phase durations (ms)
    // ========================

    /// 1 SUI in MIST
    const STAKE: u64 = 1_000_000_000;
    /// 1 hour commit phase
    const COMMIT_MS: u64 = 3_600_000;
    /// 1 hour reveal phase
    const REVEAL_MS: u64 = 3_600_000;

    // ========================
    // Helpers
    // ========================

    /// SHA2-256( bcs(addr) || vote_byte || secret ) — same as the contract
    fun make_hash(addr: address, vote: bool, secret: vector<u8>): vector<u8> {
        let mut preimage = bcs::to_bytes(&addr);
        vector::push_back(&mut preimage, if (vote) { 1u8 } else { 0u8 });
        vector::append(&mut preimage, secret);
        hash::sha2_256(preimage)
    }

    /// Bootstrap the Fossil shared object as ADMIN
    fun init_fossil(scenario: &mut Scenario) {
        ts::next_tx(scenario, ADMIN);
        fossil::init_for_testing(ts::ctx(scenario));
    }

    /// Submit a new event as `proposer` (clock starts at 0)
    fun do_submit(
        scenario: &mut Scenario,
        proposer: address,
        description: vector<u8>,
        vote: bool,
        secret: vector<u8>,
    ) {
        ts::next_tx(scenario, proposer);
        let mut fossil = ts::take_shared<Fossil>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));
        let stake_coin = coin::mint_for_testing<SUI>(STAKE, ts::ctx(scenario));
        fossil::submit(
            &mut fossil,
            description,
            b"Context for test",
            0, // CAT_SCIENCE
            stake_coin,
            STAKE,
            COMMIT_MS,
            REVEAL_MS,
            make_hash(proposer, vote, secret),
            &clock,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(fossil);
    }

    /// Commit a vote as `voter` at `now_ms` milliseconds
    fun do_commit(
        scenario: &mut Scenario,
        voter: address,
        event_id: u64,
        vote: bool,
        secret: vector<u8>,
        now_ms: u64,
    ) {
        ts::next_tx(scenario, voter);
        let mut fossil = ts::take_shared<Fossil>(scenario);
        let mut clock = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clock, now_ms);
        let stake_coin = coin::mint_for_testing<SUI>(STAKE, ts::ctx(scenario));
        fossil::commit_vote(
            &mut fossil,
            event_id,
            make_hash(voter, vote, secret),
            stake_coin,
            &clock,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(fossil);
    }

    /// Reveal a vote as `voter` at `now_ms` milliseconds
    fun do_reveal(
        scenario: &mut Scenario,
        voter: address,
        event_id: u64,
        vote: bool,
        secret: vector<u8>,
        now_ms: u64,
    ) {
        ts::next_tx(scenario, voter);
        let mut fossil = ts::take_shared<Fossil>(scenario);
        let mut clock = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clock, now_ms);
        fossil::reveal_vote(
            &mut fossil,
            event_id,
            vote,
            secret,
            &clock,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(fossil);
    }

    /// Resolve an event at `now_ms` milliseconds
    fun do_resolve(scenario: &mut Scenario, event_id: u64, now_ms: u64) {
        ts::next_tx(scenario, ADMIN);
        let mut fossil = ts::take_shared<Fossil>(scenario);
        let mut clock = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clock, now_ms);
        fossil::resolve(&mut fossil, event_id, &clock, ts::ctx(scenario));
        clock::destroy_for_testing(clock);
        ts::return_shared(fossil);
    }

    /// Claim reward as `voter`
    fun do_claim(scenario: &mut Scenario, voter: address, event_id: u64) {
        ts::next_tx(scenario, voter);
        let mut fossil = ts::take_shared<Fossil>(scenario);
        fossil::claim_reward(&mut fossil, event_id, ts::ctx(scenario));
        ts::return_shared(fossil);
    }

    // ========================
    // Tests
    // ========================

    #[test]
    fun test_submit_creates_event() {
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Did the Berlin Wall fall in 1989?", true, b"secret");

        ts::next_tx(&mut scenario, ALICE);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            assert!(fossil::event_count(&fossil) == 1, 0);
            assert!(fossil::has_committed(&fossil, 0, ALICE), 1);
            assert!(!fossil::has_revealed(&fossil, 0, ALICE), 2);
            ts::return_shared(fossil);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_for_wins() {
        // Alice FOR, Bob FOR, Carol AGAINST → FOR wins (2 > 1)
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"FOR wins", true,  b"alice_s");
        do_commit(&mut scenario, BOB,   0, true,  b"bob_s",   1_000);
        do_commit(&mut scenario, CAROL, 0, false, b"carol_s", 2_000);

        do_reveal(&mut scenario, ALICE, 0, true,  b"alice_s", COMMIT_MS + 1);
        do_reveal(&mut scenario, BOB,   0, true,  b"bob_s",   COMMIT_MS + 2);
        do_reveal(&mut scenario, CAROL, 0, false, b"carol_s", COMMIT_MS + 3);

        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            // STATUS_RESOLVED = 2
            assert!(fossil::get_event_status(&fossil, 0) == 2, 0);
            ts::return_shared(fossil);
        };

        // Winners (Alice + Bob) can claim
        do_claim(&mut scenario, ALICE, 0);
        do_claim(&mut scenario, BOB, 0);

        ts::end(scenario);
    }

    #[test]
    fun test_against_wins() {
        // Alice AGAINST, Bob AGAINST, Carol FOR → AGAINST wins (2 > 1)
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"AGAINST wins", false, b"alice_s");
        do_commit(&mut scenario, BOB,   0, false, b"bob_s",   1_000);
        do_commit(&mut scenario, CAROL, 0, true,  b"carol_s", 2_000);

        do_reveal(&mut scenario, ALICE, 0, false, b"alice_s", COMMIT_MS + 1);
        do_reveal(&mut scenario, BOB,   0, false, b"bob_s",   COMMIT_MS + 2);
        do_reveal(&mut scenario, CAROL, 0, true,  b"carol_s", COMMIT_MS + 3);

        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            assert!(fossil::get_event_status(&fossil, 0) == 2, 0);
            ts::return_shared(fossil);
        };

        // Winners (Alice + Bob) can claim
        do_claim(&mut scenario, ALICE, 0);
        do_claim(&mut scenario, BOB, 0);

        ts::end(scenario);
    }

    #[test]
    fun test_tie_both_revealers_can_claim() {
        // Alice FOR, Bob AGAINST → TIE → BOTH must be able to claim their stake back
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"TIE test", true,  b"alice_s");
        do_commit(&mut scenario, BOB,   0, false, b"bob_s", 1_000);

        do_reveal(&mut scenario, ALICE, 0, true,  b"alice_s", COMMIT_MS + 1);
        do_reveal(&mut scenario, BOB,   0, false, b"bob_s",   COMMIT_MS + 2);

        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            assert!(fossil::get_event_status(&fossil, 0) == 2, 0);
            ts::return_shared(fossil);
        };

        // Both revealers must be able to claim (refund only)
        do_claim(&mut scenario, ALICE, 0);
        do_claim(&mut scenario, BOB, 0);

        ts::end(scenario);
    }

    #[test]
    fun test_unanimous_revealer_can_claim() {
        // Alice FOR only (unanimous) — she reveals, Bob doesn't → Alice should claim refund
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Unanimous test", true, b"alice_s");
        do_commit(&mut scenario, BOB, 0, false, b"bob_s", 1_000);

        // Only Alice reveals
        do_reveal(&mut scenario, ALICE, 0, true, b"alice_s", COMMIT_MS + 1);
        // Bob does not reveal — his stake goes to founder

        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            assert!(fossil::get_event_status(&fossil, 0) == 2, 0);
            ts::return_shared(fossil);
        };

        // Alice (sole revealer) must be able to claim her refund
        do_claim(&mut scenario, ALICE, 0);

        ts::end(scenario);
    }

    #[test]
    fun test_voided_when_no_reveals() {
        // Alice commits but nobody reveals → VOIDED
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"VOIDED test", true, b"alice_s");
        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            // STATUS_VOIDED = 3
            assert!(fossil::get_event_status(&fossil, 0) == 3, 0);
            ts::return_shared(fossil);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_multiple_independent_events() {
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Event zero", true,  b"a0");
        do_submit(&mut scenario, BOB,   b"Event one",  false, b"b0");

        ts::next_tx(&mut scenario, ADMIN);
        {
            let fossil = ts::take_shared<Fossil>(&scenario);
            assert!(fossil::event_count(&fossil) == 2, 0);
            assert!(fossil::has_committed(&fossil, 0, ALICE), 1);
            assert!(fossil::has_committed(&fossil, 1, BOB), 2);
            assert!(!fossil::has_committed(&fossil, 1, ALICE), 3);
            assert!(!fossil::has_committed(&fossil, 0, BOB), 4);
            ts::return_shared(fossil);
        };

        ts::end(scenario);
    }

    // ========================
    // Failure tests
    // ========================

    #[test]
    #[expected_failure(abort_code = 6)]
    fun test_double_commit_aborts() {
        // EAlreadyCommitted = 6
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Event", true, b"secret1");
        do_commit(&mut scenario, ALICE, 0, false, b"secret2", 1_000);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 9)]
    fun test_wrong_secret_aborts() {
        // EHashMismatch = 9
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Event", true, b"real_secret");
        do_reveal(&mut scenario, ALICE, 0, true, b"wrong_secret", COMMIT_MS + 1);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 9)]
    fun test_wrong_vote_aborts() {
        // EHashMismatch = 9: correct secret but flipped vote
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Event", true, b"my_secret");
        do_reveal(&mut scenario, ALICE, 0, false, b"my_secret", COMMIT_MS + 1);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 11)]
    fun test_early_resolve_aborts() {
        // ERevealNotEnded = 11
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Event", true, b"secret");
        do_resolve(&mut scenario, 0, COMMIT_MS + 1);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 10)]
    fun test_double_resolve_aborts() {
        // EAlreadyFinalized = 10
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Event", true, b"alice_s");
        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);
        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 2);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 15)]
    fun test_double_claim_aborts() {
        // EAlreadyClaimed = 15
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Double claim", true, b"alice_s");
        do_commit(&mut scenario, BOB, 0, false, b"bob_s", 1_000);

        do_reveal(&mut scenario, ALICE, 0, true,  b"alice_s", COMMIT_MS + 1);
        do_reveal(&mut scenario, BOB,   0, false, b"bob_s",   COMMIT_MS + 2);

        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        // Alice votes FOR, Bob AGAINST → FOR wins (2>1... wait only 1 FOR vs 1 AGAINST = TIE)
        // Actually: Alice=FOR wins because we have 1 FOR (Alice) vs 1 AGAINST (Bob)
        // That is a TIE. Alice claims once → OK
        do_claim(&mut scenario, ALICE, 0);
        // Second claim → EAlreadyClaimed
        do_claim(&mut scenario, ALICE, 0);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 16)]
    fun test_loser_cannot_claim() {
        // ENotEligible = 16
        // Alice FOR, Bob FOR, Carol AGAINST → FOR wins, Carol cannot claim
        let mut scenario = ts::begin(ADMIN);
        init_fossil(&mut scenario);

        do_submit(&mut scenario, ALICE, b"Loser test", true,  b"alice_s");
        do_commit(&mut scenario, BOB,   0, true,  b"bob_s",   1_000);
        do_commit(&mut scenario, CAROL, 0, false, b"carol_s", 2_000);

        do_reveal(&mut scenario, ALICE, 0, true,  b"alice_s", COMMIT_MS + 1);
        do_reveal(&mut scenario, BOB,   0, true,  b"bob_s",   COMMIT_MS + 2);
        do_reveal(&mut scenario, CAROL, 0, false, b"carol_s", COMMIT_MS + 3);

        do_resolve(&mut scenario, 0, COMMIT_MS + REVEAL_MS + 1);

        // Carol voted AGAINST — she lost, cannot claim
        do_claim(&mut scenario, CAROL, 0);

        ts::end(scenario);
    }
}
