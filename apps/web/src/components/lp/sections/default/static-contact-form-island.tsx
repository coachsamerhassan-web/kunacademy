/**
 * Wave 15 Wave 4 PRECURSOR — Contact form client island.
 *
 * Used by StaticContactFormSection (in static-sections.tsx). Honeypot
 * field + submission state. POST destination: /api/static/contact (route
 * handles rate-limit + honeypot rejection + email forward).
 *
 * Bilingual labels supplied by parent renderer; this component is locale-naive.
 */

'use client';

import { useState } from 'react';

interface Props {
  isAr: boolean;
  submitLabel: string;
  successMessage: string;
}

const FIELD_CLASS =
  'block w-full rounded-lg border border-[var(--color-neutral-200)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
const LABEL_CLASS = 'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';

export function StaticContactFormIsland({ isAr, submitLabel, successMessage }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot: bots fill this; humans don't see it.
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/static/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, honeypot }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-base text-green-800 font-medium">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="contact-name" className={LABEL_CLASS}>
          {isAr ? 'الاسم' : 'Name'} <span className="text-red-600">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={FIELD_CLASS}
          dir={isAr ? 'rtl' : 'ltr'}
        />
      </div>

      <div>
        <label htmlFor="contact-email" className={LABEL_CLASS}>
          {isAr ? 'البريد الإلكترونيّ' : 'Email'} <span className="text-red-600">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={FIELD_CLASS}
          dir="ltr"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className={LABEL_CLASS}>
          {isAr ? 'الرسالة' : 'Message'} <span className="text-red-600">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className={`${FIELD_CLASS} resize-y`}
          dir={isAr ? 'rtl' : 'ltr'}
        />
      </div>

      {/* Honeypot — visually hidden, semantically discoverable to bots. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[var(--color-accent,#F47E42)] px-6 py-3 text-base font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500,#E66E32)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? (isAr ? 'جاري الإرسال…' : 'Sending…') : submitLabel}
      </button>
    </form>
  );
}
