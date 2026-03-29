'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './hover-card.module.css';

interface HoverCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  locale: string;
  delay?: number;
  /** Extra content rendered below the description (feature lists, CTAs, metadata) */
  children?: ReactNode;
  /** 'default' — standard padding (p-10 on md); 'compact' — reduced padding (p-6), smaller title */
  size?: 'default' | 'compact';
  /** If provided, the card becomes a link */
  href?: string;
}

/** 4-pointed star path centered at 80,80 in a 160×160 viewBox */
const StarPath = () => (
  <svg
    className={styles.starDecor}
    viewBox="0 0 160 160"
    fill="currentColor"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M80 0 C82 40, 120 78, 160 80 C120 82, 82 120, 80 160 C78 120, 40 82, 0 80 C40 78, 78 40, 80 0Z" />
  </svg>
);

export function HoverCard({
  icon,
  title,
  description,
  locale,
  delay = 0,
  children,
  size = 'default',
  href,
}: HoverCardProps) {
  const isAr = locale === 'ar';
  const cardRef = useRef<HTMLDivElement>(null);

  /* Staggered fade-in via IntersectionObserver */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              el.classList.add(styles.visible);
            }, delay * 1000);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const cardClasses = [
    styles.card,
    size === 'compact' ? styles.sizeCompact : '',
    href ? styles.hasLink : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {/* Decorative background star */}
      <StarPath />

      {/* Icon box */}
      <div className={styles.iconBox} aria-hidden="true">
        {icon}
      </div>

      {/* Title */}
      <h3
        className={styles.title}
        style={{
          fontFamily: isAr ? 'var(--font-arabic-heading)' : undefined,
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={styles.description}
        style={{
          fontFamily: isAr ? 'var(--font-arabic-body)' : undefined,
        }}
      >
        {description}
      </p>

      {/* Optional extra content */}
      {children && <div className={styles.extra}>{children}</div>}
    </>
  );

  if (href) {
    return (
      <div ref={cardRef} className={cardClasses} dir={isAr ? 'rtl' : 'ltr'}>
        <Link href={href} className={styles.linkOverlay} tabIndex={0}>
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={cardClasses} dir={isAr ? 'rtl' : 'ltr'}>
      {inner}
    </div>
  );
}
