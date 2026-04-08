'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Eye, X } from 'lucide-react';

interface Testimonial {
  id: string;
  client_name: string;
  program_name: string | null;
  text_ar: string | null;
  text_en: string | null;
  is_featured: boolean;
  is_approved: boolean;
  language: string;
  created_at: string;
}

export default function AdminTestimonialsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ program: '', featured: '', language: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Testimonial | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.program) params.set('program', filter.program);
    if (filter.featured) params.set('featured', filter.featured);
    const res = await fetch(`/api/admin/testimonials?${params}`);
    const data = await res.json();
    let rows = data.testimonials ?? [];
    if (filter.language) rows = rows.filter((t: Testimonial) => t.language === filter.language);
    setItems(rows);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    load();
  }, [user, profile, authLoading, load]);

  async function toggleFeatured(t: Testimonial) {
    await fetch('/api/admin/testimonials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, is_featured: !t.is_featured }),
    });
    await load();
  }

  async function bulkFeature(featured: boolean) {
    if (selected.size === 0) return;
    await fetch('/api/admin/testimonials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], is_featured: featured }),
    });
    setSelected(new Set());
    await load();
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(prev => prev.size === items.length ? new Set() : new Set(items.map(t => t.id)));
  }

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  const programs = [...new Set(items.map(t => t.program_name).filter(Boolean))] as string[];

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'إدارة الشهادات' : 'Testimonials'}</Heading>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Filters + Bulk */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select value={filter.program} onChange={e => setFilter(f => ({ ...f, program: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'كل البرامج' : 'All Programs'}</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filter.language} onChange={e => setFilter(f => ({ ...f, language: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'كل اللغات' : 'All Languages'}</option>
            <option value="ar">{isAr ? 'عربي' : 'Arabic'}</option>
            <option value="en">{isAr ? 'إنجليزي' : 'English'}</option>
          </select>
          <select value={filter.featured} onChange={e => setFilter(f => ({ ...f, featured: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'الكل' : 'All'}</option>
            <option value="true">{isAr ? 'مميّز' : 'Featured'}</option>
            <option value="false">{isAr ? 'عادي' : 'Not Featured'}</option>
          </select>
          {selected.size > 0 && (
            <div className="flex gap-1 ms-auto">
              <Button variant="ghost" size="sm" onClick={() => bulkFeature(true)}><Star className="w-3.5 h-3.5 me-1 text-amber-500" />{isAr ? 'تمييز' : 'Feature'} ({selected.size})</Button>
              <Button variant="ghost" size="sm" onClick={() => bulkFeature(false)}>{isAr ? 'إزالة' : 'Unfeature'} ({selected.size})</Button>
            </div>
          )}
          <span className="text-sm text-[var(--color-neutral-400)] ms-auto">{items.length} {isAr ? 'شهادة' : 'testimonials'}</span>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} className="rounded" aria-label={isAr ? 'تحديد كل الشهادات' : 'Select all testimonials'} /></th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'البرنامج' : 'Program'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'اللغة' : 'Lang'}</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">{isAr ? 'مميّز' : 'Featured'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'مقتطف' : 'Preview'}</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} className="rounded" aria-label={isAr ? `تحديد شهادة ${t.client_name}` : `Select testimonial by ${t.client_name}`} /></td>
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">{t.client_name}</td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs">{t.program_name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${t.language === 'ar' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {t.language === 'ar' ? 'AR' : 'EN'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => toggleFeatured(t)} className="p-1">
                      <Star className={`w-4 h-4 ${t.is_featured ? 'text-amber-500 fill-amber-500' : 'text-[var(--color-neutral-300)]'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs max-w-[200px] truncate">{(t.text_ar || t.text_en || '').slice(0, 80)}...</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setPreview(t)} className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"><Eye className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">{preview.client_name}</h3>
              <button onClick={() => setPreview(null)} className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)]"><X className="w-5 h-5" /></button>
            </div>
            {preview.program_name && <p className="text-xs text-[var(--color-neutral-400)] mb-3">{preview.program_name}</p>}
            {preview.text_ar && <div className="text-sm leading-relaxed mb-3 whitespace-pre-line" dir="rtl">{preview.text_ar}</div>}
            {preview.text_en && <div className="text-sm leading-relaxed whitespace-pre-line">{preview.text_en}</div>}
          </div>
        </div>
      )}
    </main>
  );
}
