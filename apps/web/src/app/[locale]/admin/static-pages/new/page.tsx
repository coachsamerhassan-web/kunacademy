/**
 * Wave 15 Wave 3 — /admin/static-pages/new — create form.
 *
 * Minimal form: slug + kind. Posts to /api/admin/static-pages, then redirects
 * to /admin/static-pages/[id] (the editor mount).
 */

'use client';

import { use, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Section } from '@kunacademy/ui/section';

const KINDS = ['static', 'program_detail', 'methodology_essay', 'portal_page'] as const;

export default function AdminStaticPageNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const router = useRouter();
  const isAr = locale === 'ar';
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState<typeof KINDS[number]>('static');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/static-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, kind }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      const id = body.id || body.row?.id;
      if (id) {
        router.push(`/${locale}/admin/static-pages/${id}`);
      } else {
        router.push(`/${locale}/admin/static-pages`);
      }
    } catch {
      setError(isAr ? 'تعذّر الإرسال' : 'Submit failed');
      setSubmitting(false);
    }
  }

  return (
    <Section variant="white">
      <div dir={isAr ? 'rtl' : 'ltr'} className="max-w-xl space-y-5">
        <div>
          <Link href={`/${locale}/admin/static-pages`} className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]">
            {isAr ? '← القائمة' : '← Back to list'}
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
          {isAr ? 'صفحة ثابتة جديدة' : 'New static page'}
        </h1>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {isAr
            ? 'سيتم إنشاء سطر فارغ بحالة «مسودّة». افتحه ليبدأ التحرير.'
            : 'Creates an empty row in draft. Open it to start editing.'}
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5">
              {isAr ? 'الرابط (slug)' : 'Slug'}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="[a-z0-9][a-z0-9-]{0,200}"
              className="block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
              dir="ltr"
              placeholder="about"
            />
            <p className="text-xs text-[var(--color-neutral-500)] mt-1">
              {isAr
                ? 'حروف صغيرة وأرقام وشرطات.'
                : 'lowercase, digits, hyphens.'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5">
              {isAr ? 'نوع الصفحة' : 'Kind'}
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof KINDS[number])}
              className="block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60"
          >
            {submitting ? (isAr ? 'جارٍ الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء' : 'Create')}
          </button>
        </form>
      </div>
    </Section>
  );
}
