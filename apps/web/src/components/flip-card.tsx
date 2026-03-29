'use client';

import React, { useState, useCallback } from 'react';
import styles from './flip-card.module.css';

interface FlipCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  locale: string;
  /** 'light' (default) — white front face; 'dark' — dark/transparent front for use on dark sections */
  variant?: 'light' | 'dark';
  /** 'default' — standard padding; 'compact' — reduced padding + smaller title for dense grids */
  size?: 'default' | 'compact';
}

export function FlipCard({
  icon,
  title,
  description,
  locale,
  variant = 'light',
  size = 'default',
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const isAr = locale === 'ar';

  const toggle = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  const hintText = isAr ? '← انقر للاكتشاف' : 'Tap to discover →';
  const ariaLabel = flipped
    ? isAr
      ? `${title} — انقر للعودة`
      : `${title} — Click to flip back`
    : isAr
    ? `${title} — انقر للاكتشاف`
    : `${title} — Click to discover`;

  const cardClasses = [
    styles.card,
    flipped ? styles.flipped : '',
    variant === 'dark' ? styles.variantDark : '',
    size === 'compact' ? styles.sizeCompact : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.scene}>
      <div
        className={cardClasses}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={ariaLabel}
      >
        {/* ── Front ── */}
        <div className={styles.front}>
          {/* Expanding rings animation — center of card */}
          <div className={styles.rings} aria-hidden="true">
            <div className={styles.ring} />
            <div className={`${styles.ring} ${styles.ring2}`} />
            <div className={`${styles.ring} ${styles.ring3}`} />
          </div>

          {/* Icon */}
          <div className={styles.iconBox}>{icon}</div>

          {/* Title */}
          <h3
            className={styles.title}
            style={{
              fontFamily: isAr
                ? 'var(--font-arabic-heading)'
                : 'var(--font-english-heading)',
            }}
          >
            {title}
          </h3>

          {/* Hint — bottom end corner */}
          <p className={styles.hint} aria-hidden="true">
            {hintText}
          </p>
        </div>

        {/* ── Back ── */}
        <div className={styles.back}>
          {/* Animated dots */}
          <div className={styles.dots} aria-hidden="true" />

          <p
            className={styles.backDesc}
            style={{
              fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit',
            }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
