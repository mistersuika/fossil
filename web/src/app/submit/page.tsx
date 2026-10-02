'use client';

import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SubmitForm } from '@/components/SubmitForm';
import { Footer } from '@/components/Footer';

export default function SubmitPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 lg:px-8 py-16">

        {/* Header */}
        <div className="mb-12">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--subtle)] font-medium mb-5">
            New Entry
          </div>
          <h1 className="text-4xl font-bold text-[var(--foreground)] tracking-tight mb-5 leading-tight">
            Submit a Claim
          </h1>
          <p className="text-base text-[var(--muted)] leading-relaxed max-w-lg">
            A claim is a clear, verifiable statement about the world.
            The community will stake SUI to vote on its historical truth.
            Accepted claims are permanently archived as collective memory.
          </p>
        </div>

        {/* Guidelines */}
        <div className="mb-10 border-l-2 border-[var(--border)] pl-5">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            Guidelines
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--subtle)] leading-relaxed">
            <li>Claims must be specific and fact-checkable — not opinions.</li>
            <li>Good example: <em className="text-[var(--muted)]">"The Renaissance began in Italy in the 14th century."</em></li>
            <li>Avoid vague, predictive, or speculative statements.</li>
          </ul>
        </div>

        <SubmitForm onSuccess={(claimId) => {
          if (claimId) {
            router.push(`/event/${claimId}`);
          } else {
            router.push('/');
          }
        }} />
      </main>

      <Footer />
    </div>
  );
}
