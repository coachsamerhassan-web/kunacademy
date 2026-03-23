import * as React from 'react';
import { cn } from './utils';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'dark' | 'white';
  pattern?: boolean;
}

export function Section({
  variant = 'default',
  pattern = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        'relative py-[var(--section-padding-mobile)] md:py-[var(--section-padding)]',
        variant === 'default' && 'bg-[var(--color-background)]',
        variant === 'dark' && 'bg-[var(--color-primary)] text-white',
        variant === 'white' && 'bg-white',
        className
      )}
      {...props}
    >
      {pattern && (
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30z' fill='%23474099' fill-opacity='0.4'/%3E%3C/svg%3E")`,
            backgroundSize: '30px 30px',
          }}
        />
      )}
      <div className="relative mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
        {children}
      </div>
    </section>
  );
}
