'use client';

import { useState, useEffect } from 'react';

// Module-level flag: resets on page refresh, survives React Strict Mode double-mount
let splashShown = false;

export function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'done'>('done');

  useEffect(() => {
    if (splashShown) return;
    splashShown = true;

    setPhase('visible');
    const fadeTimer = setTimeout(() => setPhase('fading'), 3200);
    const doneTimer = setTimeout(() => setPhase('done'), 4400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[var(--background)] flex items-center justify-center"
      style={{
        transition: 'opacity 1.2s ease',
        opacity: phase === 'fading' ? 0 : 1,
        pointerEvents: 'none',
      }}
    >
      <div className="text-center px-8 max-w-2xl mx-auto">
        <p className="splash-quote text-3xl md:text-4xl font-light text-[var(--foreground)] leading-[1.3] tracking-tight">
          "An immutable record<br />of what an era holds<br />to be true."
        </p>
        <div className="splash-source mt-10 flex items-center justify-center gap-4">
          <div className="h-px w-10 bg-[var(--border-strong)]" />
          <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-[var(--muted)]">
            FOSSIL
          </span>
          <div className="h-px w-10 bg-[var(--border-strong)]" />
        </div>
      </div>

      <style jsx>{`
        .splash-quote {
          opacity: 0;
          transform: translateY(20px);
          animation: rise 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
        }
        .splash-source {
          opacity: 0;
          transform: translateY(10px);
          animation: rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1.2s forwards;
        }
        @keyframes rise {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
