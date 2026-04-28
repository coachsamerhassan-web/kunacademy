/**
 * Wave 15 Wave 3 — Field-level debounce hook for live preview cadence.
 *
 * Per Hakawati §6.4:
 *   - Scalar fields:    300ms debounce
 *   - Rich text:        500ms debounce
 *   - Layout/theme:     instant (0ms)
 *   - Image upload:     instant on complete; skeleton during upload
 *
 * Usage:
 *   const { debouncedSection, setField } = useDebouncedSection(section, onChange);
 *   // setField('title_ar', value, 'scalar')
 *   // setField('body_ar', richDoc, 'rich')
 *   // setField('type', type, 'layout') // instant
 *
 * Internal: we maintain a "display" copy of the section in local state so
 * the form input shows changes immediately (no visible lag). The canvas
 * receives the debounced update. This is the standard "controlled input"
 * pattern extended to a whole section.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LpSection } from '@/lib/lp/composition-types';

export type FieldKind = 'scalar' | 'rich' | 'layout' | 'image';

const DEBOUNCE_MS: Record<FieldKind, number> = {
  scalar: 300,
  rich: 500,
  layout: 0,
  image: 0,
};

interface UseDebouncedSectionReturn {
  /** The display section (immediately updated — bind to form inputs). */
  displaySection: LpSection;
  /** Update a single field with debouncing applied per kind. */
  setField: (field: string, value: unknown, kind: FieldKind) => void;
  /** Force-flush any pending debounced updates (e.g., on blur, before save). */
  flush: () => void;
}

export function useDebouncedSection(
  section: LpSection,
  onChange: (next: LpSection) => void,
): UseDebouncedSectionReturn {
  // displaySection mirrors the form inputs immediately.
  const [displaySection, setDisplaySection] = useState<LpSection>(section);

  // Sync displaySection when the section prop changes from outside
  // (e.g., another agent writing to the same row, canvas reorder).
  useEffect(() => {
    setDisplaySection(section);
  }, [section]);

  // Pending debounce refs per field kind (one timer per field key so
  // typing in `title_ar` doesn't reset the timer for `body_ar`).
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Latest pending value per field (so the flush function emits the right value).
  const pendingPatch = useRef<Record<string, unknown>>({});

  const flush = useCallback(() => {
    if (Object.keys(pendingPatch.current).length === 0) return;
    setDisplaySection((prev) => {
      const next = { ...(prev as unknown as Record<string, unknown>), ...pendingPatch.current } as unknown as LpSection;
      pendingPatch.current = {};
      // Clear all timers.
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
      onChange(next);
      return next;
    });
  }, [onChange]);

  const setField = useCallback(
    (field: string, value: unknown, kind: FieldKind) => {
      // Always update the display section immediately.
      setDisplaySection((prev) => {
        const next = { ...(prev as unknown as Record<string, unknown>), [field]: value } as unknown as LpSection;
        pendingPatch.current[field] = value;

        const delay = DEBOUNCE_MS[kind];

        if (delay === 0) {
          // Instant — emit immediately, clear any pending timer for this field.
          const existing = timers.current.get(field);
          if (existing) {
            clearTimeout(existing);
            timers.current.delete(field);
          }
          delete pendingPatch.current[field];
          onChange(next);
          return next;
        }

        // Debounced — replace any existing timer for this field.
        const existing = timers.current.get(field);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          timers.current.delete(field);
          const patch = pendingPatch.current;
          if (patch[field] !== undefined) {
            delete patch[field];
          }
          onChange(next);
        }, delay);

        timers.current.set(field, timer);
        return next;
      });
    },
    [onChange],
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { displaySection, setField, flush };
}
