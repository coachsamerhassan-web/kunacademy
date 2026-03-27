import type { ReactNode } from 'react';

interface TreePhaseProps {
  children: ReactNode;
  phase: 'roots' | 'trunk' | 'branches' | 'canopy';
  align?: 'start' | 'end';
}

export function TreePhase({ children, phase, align = 'start' }: TreePhaseProps) {
  return (
    <div
      data-tree-phase={phase}
      className={`py-16 md:py-24 px-6 flex ${align === 'end' ? 'justify-end' : 'justify-start'}`}
    >
      <div className="tree-card bg-[var(--color-primary)] text-white rounded-2xl p-8 md:p-10 max-w-lg shadow-xl">
        {children}
      </div>
    </div>
  );
}
