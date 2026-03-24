import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

/**
 * Button — Stitch "The Catalyst" design.
 * Primary uses tertiary_fixed_dim (Mandarin).
 * Hover: scale(1.02) + increased shadow diffusion.
 * Min touch target: 44px.
 */

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center font-medium',
    'transition-all duration-300 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'hover:scale-[1.02] active:scale-[0.98]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-accent)] text-white',
          'shadow-[0_4px_16px_rgba(244,126,66,0.25)]',
          'hover:bg-[var(--color-accent-500)]',
          'hover:shadow-[0_8px_24px_rgba(244,126,66,0.35)]',
          'focus-visible:ring-[var(--color-accent)]',
          'rounded-xl',
        ].join(' '),
        secondary: [
          'border-2 border-[var(--color-primary)] text-[var(--color-primary)]',
          'bg-transparent',
          'hover:bg-[var(--color-primary-50)]',
          'hover:shadow-[0_4px_16px_rgba(71,64,153,0.12)]',
          'focus-visible:ring-[var(--color-primary)]',
          'rounded-xl',
        ].join(' '),
        ghost: [
          'text-[var(--color-primary)]',
          'hover:underline',
          'focus-visible:ring-[var(--color-primary)]',
          'rounded-lg',
        ].join(' '),
        /** White variant for dark backgrounds */
        white: [
          'bg-white text-[var(--color-primary)]',
          'shadow-[0_4px_16px_rgba(255,255,255,0.15)]',
          'hover:shadow-[0_8px_24px_rgba(255,255,255,0.25)]',
          'focus-visible:ring-white',
          'rounded-xl',
        ].join(' '),
      },
      size: {
        sm: 'h-9 px-4 text-sm rounded-lg',
        md: 'h-11 px-6 text-base min-h-[44px]',
        lg: 'h-14 px-8 text-lg min-h-[44px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
