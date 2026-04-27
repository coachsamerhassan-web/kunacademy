/**
 * Wave 15 Wave 3 — Auto-save hook.
 *
 * Per spec §3e: 5s idle / 30s active autosave. Optimistic concurrency via
 * an `If-Match` header carrying the row's `updated_at` ISO string (Wave 15
 * W2 routes ignore `If-Match` for now, but we send it for forward-compat
 * when the server adds 412 handling — design surface for that lives in the
 * agent-api/route-helpers.ts; admin routes will follow).
 *
 * Pattern:
 *   const { status, lastSavedAt, save, isDirty } = useAutoSave({
 *     value, onSave: async (v) => { ... }, debounceIdleMs: 5000, ...
 *   });
 *
 * Behavior:
 *   - On every value change (referential): mark dirty, schedule idle timer.
 *   - If idle 5s: fire onSave.
 *   - If still typing past 30s: force-save (active timer).
 *   - In-flight saves suppress new fires until the current one resolves.
 *   - Failure: status='error' + error message preserved in state; user can
 *     manually retry via save().
 *
 * Concurrency etag:
 *   onSave receives the current value AND the `etag` (last-known
 *   updated_at). The caller's onSave implementation puts `If-Match`
 *   header on its PATCH. On 412 (Precondition Failed) the caller surfaces
 *   a conflict banner — that path is wired POST-canary (the canary
 *   demonstrates 200-OK happy-path autosave).
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type AutoSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveOptions<T> {
  /** Current authored value. Reference equality determines dirtiness. */
  value: T;
  /** Stable etag (e.g. row.updated_at ISO). Sent as `If-Match`. */
  etag?: string | null;
  /** Save handler — return the new etag on success. Throw on failure. */
  onSave: (value: T, etag?: string | null) => Promise<string | null | void>;
  /** Idle window: time since last edit before save fires. Default 5000ms. */
  debounceIdleMs?: number;
  /** Active window: max time edits can keep deferring saves. Default 30000ms. */
  maxActiveMs?: number;
  /** Disable autosave (e.g. when no row is loaded yet). Default false. */
  disabled?: boolean;
}

export interface UseAutoSaveResult {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  errorMessage: string | null;
  /** Manual save trigger. Returns true if a save was attempted. */
  save: () => Promise<boolean>;
  /** Convenience flag — true when there's been an edit since the last save. */
  isDirty: boolean;
}

export function useAutoSave<T>({
  value,
  etag,
  onSave,
  debounceIdleMs = 5000,
  maxActiveMs = 30000,
  disabled = false,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const lastSavedRef = useRef<T | null>(null);
  const valueRef = useRef<T>(value);
  const etagRef = useRef<string | null | undefined>(etag);

  // Track the latest value + etag for the timer-fired save.
  valueRef.current = value;
  etagRef.current = etag;

  const performSave = useCallback(async (): Promise<boolean> => {
    if (disabled) return false;
    if (inFlight.current) return false;
    inFlight.current = true;
    setStatus('saving');
    setErrorMessage(null);
    try {
      const next = await onSave(valueRef.current, etagRef.current ?? null);
      lastSavedRef.current = valueRef.current;
      setLastSavedAt(new Date());
      setStatus('saved');
      setIsDirty(false);
      if (typeof next === 'string') etagRef.current = next;
      return true;
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      inFlight.current = false;
      // Clear both timers — they'll re-arm on next edit.
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      if (activeTimer.current) {
        clearTimeout(activeTimer.current);
        activeTimer.current = null;
      }
    }
  }, [onSave, disabled]);

  // Detect value changes via referential identity. The caller is expected
  // to produce stable references on no-op renders (typical with useState
  // setter not being called) — when the value object is recreated, we mark
  // dirty and arm the timers.
  useEffect(() => {
    if (disabled) return;
    if (lastSavedRef.current === value) return;
    if (lastSavedRef.current === null && status === 'idle') {
      // First render — establish the baseline without scheduling a save.
      lastSavedRef.current = value;
      return;
    }
    setIsDirty(true);
    setStatus('dirty');
    // Reset idle timer on every edit (debounce).
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      performSave();
    }, debounceIdleMs);
    // Active timer — only set if not already running (so it acts as a
    // hard ceiling; rapid edits don't push it forever).
    if (!activeTimer.current) {
      activeTimer.current = setTimeout(() => {
        performSave();
      }, maxActiveMs);
    }
  }, [value, debounceIdleMs, maxActiveMs, performSave, disabled, status]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (activeTimer.current) clearTimeout(activeTimer.current);
    };
  }, []);

  return {
    status,
    lastSavedAt,
    errorMessage,
    save: performSave,
    isDirty,
  };
}

/** Format a timestamp as relative "Saved Xs ago" / "Saved Nm ago". Hakawati U12
 *  default: relative is calmer than absolute. */
export function formatRelative(when: Date | null, isAr: boolean, now = new Date()): string {
  if (!when) return isAr ? 'لم يُحفظ بعد' : 'Not saved yet';
  const diffSec = Math.max(0, Math.floor((now.getTime() - when.getTime()) / 1000));
  if (diffSec < 5) return isAr ? 'حُفظ الآن' : 'Saved just now';
  if (diffSec < 60) return isAr ? `حُفظ منذ ${diffSec} ث` : `Saved ${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isAr ? `حُفظ منذ ${diffMin} د` : `Saved ${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  return isAr ? `حُفظ منذ ${diffH} س` : `Saved ${diffH}h ago`;
}
