import * as React from 'react';
import { cn } from './utils';

const sizeMap = {
  1: 'text-[var(--text-page-title)]',
  2: 'text-[var(--text-section)]',
  3: 'text-[var(--text-card-title)]',
  4: 'text-[var(--text-lead)]',
  5: 'text-[var(--text-body)]',
  6: 'text-[var(--text-small)]',
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
        'font-bold leading-tight text-[var(--text-primary)]',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
