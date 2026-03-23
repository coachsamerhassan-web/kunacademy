import * as React from 'react';
import { cn } from './utils';

const sizeMap = {
  1: 'text-[var(--text-h1)]',
  2: 'text-[var(--text-h2)]',
  3: 'text-[var(--text-h3)]',
  4: 'text-[var(--text-h4)]',
  5: 'text-[var(--text-h5)]',
  6: 'text-[var(--text-h6)]',
} as const;

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function Heading({ level = 2, className, children, ...props }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      className={cn(
        sizeMap[level],
        'font-bold leading-tight tracking-tight text-[var(--color-text)]',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
