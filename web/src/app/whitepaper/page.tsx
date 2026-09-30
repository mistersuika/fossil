import React from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Whitepaper — FOSSIL',
  description: 'FOSSIL White Paper v3.1 — The Registry of Epistemological Truth',
};

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xs font-bold text-[var(--subtle)] tabular-nums tracking-widest uppercase">{number}</span>
        <h2 className="text-lg font-bold text-[var(--foreground)] tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-[var(--muted)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Sub({ title }: { title: string }) {
  return <p className="text-xs font-bold text-[var(--foreground)] uppercase tracking-widest mt-6 mb-2">{title}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--border-strong)] flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-5 border-l-2 border-[var(--border)] my-4">
      <p className="text-sm text-[var(--muted)] italic leading-relaxed">{children}</p>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-raised)] rounded-[var(--radius-sm)] border border-[var(--border)] px-5 py-3 font-mono text-xs text-[var(--foreground)] my-4">
      {children}
    </div>
  );
}

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 lg:px-8 py-16">

        {/* Back */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors uppercase tracking-widest font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Header */}
        <div className="mb-16 pb-10 border-b border-[var(--border)]">
          <p className="text-xs font-bold text-[var(--subtle)] uppercase tracking-widest mb-4">White Paper</p>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--foreground)] tracking-tight leading-tight mb-4">
            FOSSIL
          </h1>
          <p className="text-base text-[var(--muted)] mb-6">
            The Registry of Epistemological Truth<br />
            Decentralized Protocol for Collective Memory on Sui
          </p>
          <div className="flex items-center gap-4 text-xs text-[var(--subtle)]">
            <span>Version 3.1</span>
            <span className="text-[var(--border)]">·</span>
            <span>March 2026</span>
          </div>
        </div>

        {/* Sections */}
        <Section number="1" title="Philosophy & Vision">
          <Sub title="The distinction between Reality and Truth" />
          <p>The foundation of FOSSIL rests on an essential philosophical nuance: the distinction between Reality and Truth.</p>
          <Highlight>
            Reality exists independently of the observer. Truth, on the other hand, is a human construction: an interpretation of the world validated by knowledge, evidence, methods, and the consensus of a given era.
          </Highlight>
          <p>FOSSIL does not claim to capture absolute reality. FOSSIL archives what a collectivity considers true at a given moment: the <strong className="text-[var(--foreground)]">Truth of the Moment</strong>.</p>
          <Sub title="Our vision" />
          <p>FOSSIL is a chronology of the evolution of human thought.</p>
          <p>By archiving an economic and social consensus at a moment T, the protocol protects each stage of our understanding against forgetting, alteration, or retroactive revisionism.</p>
          <p>We are building a system in which:</p>
          <List items={[
            'truth is verified, not imposed;',
            'economic alignment encourages honesty;',
            'epistemological humility is the rule: what we consider true today may become tomorrow a historical curiosity.',
          ]} />
        </Section>

        <Section number="2" title="The Problem">
          <Sub title="Centralized revisionism" />
          <p>Current information systems — collaborative encyclopedias, institutional databases, state archives, private platforms — are mutable. A past truth can be erased, corrected, reformulated, or replaced to fit present interests.</p>
          <Sub title="Crisis of trust" />
          <p>The absence of skin in the game in information verification allows:</p>
          <List items={[
            'manipulation campaigns;',
            'artificial consensus;',
            'the use of bots and synthetic identities;',
            'the diffusion of narratives at no real cost for their authors.',
          ]} />
          <p>When no risk is associated with taking a position, the value of collective validation collapses.</p>
          <Sub title="Loss of historical context" />
          <p>We gradually lose the memory of our own frameworks of thought: what we believed, why we believed it, how our certainties evolved. Without this memory, we sometimes preserve the conclusions, but we lose the history of their formation.</p>
        </Section>

        <Section number="3" title="The Solution: the FOSSIL Protocol">
          <p>FOSSIL introduces a decentralized consensus protocol designed to archive the truth of a given moment. It relies on:</p>
          <List items={[
            'a commit–reveal voting mechanism;',
            'a staking system in SUI;',
            'an economic redistribution model;',
            'the immutability provided by the Sui blockchain.',
          ]} />
          <p>Each submission takes the form of a <strong className="text-[var(--foreground)]">claim</strong>: a clear, contextualized, and categorized statement submitted to collective judgment.</p>
          <Highlight>
            The result of the process does not claim to produce absolute truth. It records an archived truth — the state of a consensus at a given moment.
          </Highlight>
        </Section>

        <Section number="4" title="Consensus Mechanism">
          <p>The protocol relies on a hidden-commit vote structured in four phases.</p>
          <Sub title="1 · Proposal" />
          <p>A user submits a claim with: a description, a context, a category, a stake in SUI, commit and reveal phase durations, and a cryptographic hash corresponding to their own initial vote. The proposer automatically becomes the first voter.</p>
          <Sub title="2 · Commit" />
          <p>During the commit phase, voters submit their stake and a cryptographically sealed vote. The vote is not revealed publicly at this stage — only a hash is recorded on-chain.</p>
          <p>The hash is computed as follows:</p>
          <CodeBlock>SHA2-256( bcs(address) ∥ vote ∥ secret )</CodeBlock>
          <p>This ensures that the vote remains invisible, no trend can be observed, and it is not possible to opportunistically follow the majority as it forms.</p>
          <Sub title="3 · Reveal" />
          <p>During the reveal phase, voters reveal their vote and their secret. The contract verifies that the revealed data matches the original commitment. Participants who fail to reveal lose their stake.</p>
          <Sub title="4 · Resolution" />
          <p>Once the reveal phase is over, any user can trigger the resolution of the event. The protocol determines the final result, the majority side, and the rewards claimable individually.</p>
          <p>Winners recover their stake and receive a share of the stakes lost by the losing side. Rewards are claimed individually through a dedicated function.</p>
        </Section>

        <Section number="5" title="Technical Architecture on Sui">
          <p>FOSSIL is implemented in Move on the Sui blockchain.</p>
          <Sub title="Object model" />
          <p>The protocol relies on a main shared object, <code className="text-xs font-mono bg-[var(--surface-raised)] px-1.5 py-0.5 rounded border border-[var(--border)]">Fossil</code>, which contains: the events table, the commits table, the table of already claimed rewards, the global event counter, and the founder address.</p>
          <Sub title="Structured data" />
          <CodeBlock>
            events: Table{'<'}u64, EventRecord{'>'}{'\n'}
            commits: Table{'<'}CommitKey, CommitRecord{'>'}{'\n'}
            rewards_claimed: Table{'<'}CommitKey, bool{'>'}
          </CodeBlock>
          <Sub title="On-chain events" />
          <p>To allow indexing and frontend reading, the protocol emits:</p>
          <List items={['EventCreated', 'VoteCommitted', 'VoteRevealed', 'EventFinalized', 'RewardClaimed']} />
          <Highlight>
            FOSSIL is not only an executable contract, but also a readable, observable, and indexable memory layer.
          </Highlight>
        </Section>

        <Section number="6" title="Protocol Parameters">
          <p>The current protocol defines: a minimum stake to vote and propose, a maximum description and context length, a minimum duration per phase, a maximum total duration, and a predefined set of categories.</p>
          <Sub title="Supported categories" />
          <List items={['Science', 'Economics', 'Politics', 'Society', 'Technology']} />
          <Sub title="Note on current parameters" />
          <p>In the current contract configuration, minimum values are set at a reduced level, in test mode, to facilitate experimentation on Sui. These values should not be considered final. Final parameters depend on deployment context and desired Sybil resistance.</p>
        </Section>

        <Section number="7" title="Economic Model">
          <Highlight>
            A collective truth has value only if those who validate it assume real risk.
          </Highlight>
          <p>Each participant commits a stake. After the vote: losers lose their stake; winners recover their stake and share the losing pool; non-revealers are penalized; a small fee is taken.</p>
          <Sub title="Distribution" />
          <p>In a normal resolution:</p>
          <List items={[
            '1% of the losing pool goes to the proposer;',
            '1% goes to the founder / protocol;',
            'the remaining 98% is distributed to winners proportionally.',
          ]} />
          <Sub title="Special cases" />
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Tie', desc: 'Revealers get their stake back' },
              { label: 'Unanimity', desc: 'Revealers get their stake back' },
              { label: 'No reveal', desc: 'Event is voided' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-[var(--surface)] rounded-[var(--radius-sm)] border border-[var(--border)] p-4 text-center">
                <p className="text-xs font-bold text-[var(--foreground)] mb-1">{label}</p>
                <p className="text-xs text-[var(--subtle)]">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section number="8" title="Game Theory">
          <p>FOSSIL creates a Schelling-game-like environment where the rational strategy is to vote according to what one believes will be the strongest consensus based on available evidence.</p>
          <p>The system encourages serious evaluation of claims, anticipation of collective judgment, and avoidance of impulsive voting.</p>
          <p>Commit–reveal is essential because: majority cannot be followed, coordination is harder, and vote buying is inefficient. Economic alignment creates epistemic discipline.</p>
        </Section>

        <Section number="9" title="Security">
          <Sub title="Sybil resistance" />
          <p>One wallet = one vote, but each vote costs SUI. Creating many wallets is not free. Resistance is economic, not identity-based.</p>
          <Sub title="Vote buying resistance" />
          <p>Commit hides the vote. Bribery cannot be verified before reveal.</p>
          <Sub title="Collusion resistance" />
          <p>Votes are hidden during commit. Coordination is difficult.</p>
          <Sub title="Immutability" />
          <p>On-chain state is permanent. No retroactive editing. Each event becomes part of collective memory.</p>
        </Section>

        <Section number="10" title="Scalability and Reward Distribution">
          <p>Resolution only computes the result. Rewards are claimed later via <code className="text-xs font-mono bg-[var(--surface-raised)] px-1.5 py-0.5 rounded border border-[var(--border)]">claim_reward()</code>.</p>
          <p>This architecture is scalable, modular, safer, and cheaper in gas.</p>
        </Section>

        <Section number="11" title="User Experience">
          <p>The user should only: read, vote, reveal, claim. Commit–reveal complexity remains hidden.</p>
          <Highlight>
            FOSSIL is not a dashboard. It is a memory interface.
          </Highlight>
        </Section>

        <Section number="12" title="Limits">
          <p>FOSSIL does not capture Reality. It captures a situated consensus.</p>
          <List items={[
            'low participation may skew results;',
            'manipulation is possible but economically costly;',
            'depends on the quality and diversity of voters;',
            'majority consensus ≠ absolute truth.',
          ]} />
          <p>This is intentional. FOSSIL records what a community believes — not what is objectively true.</p>
        </Section>

        <Section number="13" title="Conclusion">
          <p>FOSSIL is not only a technological tool. It is a philosophical infrastructure of memory.</p>
          <p>By recording not only statements but the way they are validated, FOSSIL becomes:</p>
          <List items={[
            'a defense against revisionism;',
            'an archive of intellectual progress;',
            'a mirror of human thought;',
            'a foundation for future understanding.',
          ]} />
          <div className="mt-8 pt-8 border-t border-[var(--border)] text-center space-y-2">
            <p className="text-sm text-[var(--muted)] italic">We do not capture Reality.</p>
            <p className="text-base font-bold text-[var(--foreground)]">We archive the Truth of the Moment.</p>
            <p className="text-xs text-[var(--subtle)] uppercase tracking-widest mt-4">Truth is verified, not dictated.</p>
          </div>
        </Section>

        {/* Footer meta */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--subtle)]">
          <span>Document Version 3.1</span>
          <span>Last Updated: March 2026</span>
        </div>

      </main>

      <Footer />
    </div>
  );
}
