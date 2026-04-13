'use client';

import Image from 'next/image';
import { useState, useCallback, useRef } from 'react';
import { Search, CheckCircle, Clock, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card } from '@kunacademy/ui/card';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraduateBadge {
  badge_slug: string;
  badge_label_ar: string;
  badge_label_en: string;
  badge_image_url: string | null;
  program_slug: string;
}

interface GraduateResult {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  photo_url: string | null;
  country: string | null;
  certificates: GraduateBadge[];
}

type ClaimStatus = 'idle' | 'searching' | 'confirming' | 'submitting' | 'approved' | 'pending' | 'error' | 'conflict';

// ── Gradient palette for initials ─────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-yellow-400 to-amber-500',
  'from-orange-400 to-red-500',
  'from-amber-500 to-yellow-600',
  'from-yellow-500 to-orange-600',
];

function getGradient(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ── Country flags ─────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  'UAE': '\u{1F1E6}\u{1F1EA}', 'Saudi Arabia': '\u{1F1F8}\u{1F1E6}',
  'Egypt': '\u{1F1EA}\u{1F1EC}', 'Jordan': '\u{1F1EF}\u{1F1F4}',
  'Kuwait': '\u{1F1F0}\u{1F1FC}', 'Qatar': '\u{1F1F6}\u{1F1E6}',
  'Bahrain': '\u{1F1E7}\u{1F1ED}', 'Oman': '\u{1F1F4}\u{1F1F2}',
  'Lebanon': '\u{1F1F1}\u{1F1E7}', 'Morocco': '\u{1F1F2}\u{1F1E6}',
  'KSA': '\u{1F1F8}\u{1F1E6}', 'Algeria': '\u{1F1E9}\u{1F1FF}',
  'Sudan': '\u{1F1F8}\u{1F1E9}',
};

function getFlag(country: string | null): string {
  if (!country) return '';
  return COUNTRY_FLAGS[country.split(',')[0].trim()] ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  locale: string;
}

export function ClaimForm({ locale }: Props) {
  const isAr = locale === 'ar';

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GraduateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ClaimStatus>('idle');
  const [selectedMember, setSelectedMember] = useState<GraduateResult | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search graduates ────────────────────────────────────────────────────
  const searchGraduates = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: query, limit: '10' });
      const res = await fetch(`/api/graduates?${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.graduates ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setStatus('idle');
    setSelectedMember(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchGraduates(value);
    }, 300);
  };

  // ── Select a graduate to claim ──────────────────────────────────────────
  const handleSelect = (graduate: GraduateResult) => {
    setSelectedMember(graduate);
    setStatus('confirming');
    setEmail('');
    setMessage('');
    setResponseMessage('');
  };

  // ── Submit claim ────────────────────────────────────────────────────────
  const handleSubmitClaim = async () => {
    if (!selectedMember || !email.trim()) return;

    setStatus('submitting');
    try {
      const res = await fetch('/api/graduates/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember.id,
          email: email.trim(),
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setStatus('conflict');
        setResponseMessage(
          isAr
            ? 'هذا الملف مربوط بحساب بالفعل.'
            : 'This profile has already been claimed.'
        );
        return;
      }

      if (res.status === 429) {
        setStatus('error');
        setResponseMessage(
          isAr
            ? 'محاولات كثيرة. يرجى المحاولة لاحقا.'
            : 'Too many attempts. Please try again later.'
        );
        return;
      }

      if (!res.ok) {
        setStatus('error');
        setResponseMessage(data.error || (isAr ? 'حدث خطأ' : 'An error occurred'));
        return;
      }

      if (data.status === 'approved') {
        setStatus('approved');
        setResponseMessage(
          isAr
            ? 'تم ربط ملفك الشخصي بنجاح! بريدك الإلكتروني يتطابق مع سجلاتنا.'
            : 'Profile claimed successfully! Your email matches our records.'
        );
      } else {
        setStatus('pending');
        setResponseMessage(
          isAr
            ? 'تم إرسال طلبك. سيراجعه أحد المسؤولين.'
            : 'Your claim request has been submitted. An administrator will review it.'
        );
      }
    } catch {
      setStatus('error');
      setResponseMessage(isAr ? 'حدث خطأ في الاتصال' : 'Connection error');
    }
  };

  const handleBack = () => {
    setStatus('idle');
    setSelectedMember(null);
    setResponseMessage('');
  };

  // ── Render: Success / Pending / Error states ────────────────────────────
  if (status === 'approved' || status === 'pending' || status === 'conflict') {
    const isSuccess = status === 'approved';
    const isPending = status === 'pending';
    return (
      <div className="max-w-lg mx-auto text-center py-8">
        <div className={`mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center ${
          isSuccess ? 'bg-emerald-100' : isPending ? 'bg-amber-100' : 'bg-red-100'
        }`}>
          {isSuccess ? (
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          ) : isPending ? (
            <Clock className="w-8 h-8 text-amber-600" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-600" />
          )}
        </div>
        <h2
          className="text-xl font-bold text-[var(--text-primary)] mb-3"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isSuccess
            ? (isAr ? 'تم بنجاح' : 'Success')
            : isPending
              ? (isAr ? 'قيد المراجعة' : 'Under Review')
              : (isAr ? 'مربوط بالفعل' : 'Already Claimed')
          }
        </h2>
        <p className="text-[var(--color-neutral-600)] mb-6">{responseMessage}</p>
        {selectedMember && (
          <a
            href={`/${locale}/graduates/${selectedMember.slug}`}
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium transition-colors"
          >
            {isAr ? (
              <>
                <ArrowRight className="w-4 h-4" />
                عرض الملف الشخصي
              </>
            ) : (
              <>
                View profile
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </>
            )}
          </a>
        )}
      </div>
    );
  }

  // ── Render: Confirming / Submitting ─────────────────────────────────────
  if ((status === 'confirming' || status === 'submitting' || status === 'error') && selectedMember) {
    const name = isAr ? selectedMember.name_ar : selectedMember.name_en;
    const initial = (selectedMember.name_en || selectedMember.name_ar).charAt(0).toUpperCase();
    const gradient = getGradient(selectedMember.slug);

    return (
      <div className="max-w-lg mx-auto">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-neutral-500)] hover:text-amber-600 transition-colors min-h-[44px]"
        >
          {isAr ? (
            <>
              <ArrowRight className="w-4 h-4" />
              {'\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0628\u062D\u062B'}
            </>
          ) : (
            <>
              <ArrowLeft className="w-4 h-4" />
              Back to search
            </>
          )}
        </button>

        <Card accent className="p-6">
          {/* Selected graduate preview */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--color-neutral-100)]">
            <div className="relative shrink-0 h-14 w-14 rounded-full overflow-hidden">
              {selectedMember.photo_url ? (
                <Image src={selectedMember.photo_url} alt={name} fill className="object-cover" sizes="56px" />
              ) : (
                <div className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${gradient} text-white text-xl font-bold`}>
                  {initial}
                </div>
              )}
            </div>
            <div>
              <h3
                className="font-bold text-base text-[var(--text-primary)]"
                dir={isAr ? 'rtl' : 'ltr'}
              >
                {name}
              </h3>
              {selectedMember.country && (
                <span className="text-sm text-[var(--color-neutral-500)]">
                  {getFlag(selectedMember.country)} {selectedMember.country}
                </span>
              )}
            </div>
          </div>

          {/* Email input */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="claim-email"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
              >
                {isAr ? 'بريدك الإلكتروني' : 'Your email address'}
              </label>
              <input
                id="claim-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? 'example@email.com' : 'example@email.com'}
                className={`
                  w-full rounded-xl border border-[var(--color-neutral-200)] bg-white
                  py-2.5 px-4 text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--color-neutral-400)]
                  focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400
                  transition-all duration-200
                `}
                dir="ltr"
                required
                disabled={status === 'submitting'}
              />
              <p className="mt-1.5 text-xs text-[var(--color-neutral-400)]">
                {isAr
                  ? 'إذا تطابق بريدك مع سجلاتنا، سيتم ربط ملفك فورا. خلاف ذلك سيراجعه المسؤول.'
                  : 'If your email matches our records, your profile will be linked instantly. Otherwise, an admin will review.'}
              </p>
            </div>

            {/* Optional message */}
            <div>
              <label
                htmlFor="claim-message"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
              >
                {isAr ? 'رسالة (اختياري)' : 'Message (optional)'}
              </label>
              <textarea
                id="claim-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isAr ? 'أي معلومات إضافية للمراجع...' : 'Any additional info for the reviewer...'}
                rows={3}
                maxLength={500}
                className={`
                  w-full rounded-xl border border-[var(--color-neutral-200)] bg-white
                  py-2.5 px-4 text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--color-neutral-400)]
                  focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400
                  transition-all duration-200 resize-none
                `}
                dir={isAr ? 'rtl' : 'ltr'}
                disabled={status === 'submitting'}
              />
            </div>

            {/* Error message */}
            {status === 'error' && responseMessage && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {responseMessage}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmitClaim}
              disabled={!email.trim() || status === 'submitting'}
              className="
                w-full rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white
                min-h-[44px]
                hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              {status === 'submitting'
                ? (isAr ? 'جاري الإرسال...' : 'Submitting...')
                : (isAr ? 'ارسل طلب الربط' : 'Submit claim request')
              }
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Render: Search + Results ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Search bar */}
      <div className="relative mb-6">
        <Search
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-neutral-400)] pointer-events-none
            ${isAr ? 'right-4' : 'left-4'}`}
          aria-hidden="true"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={isAr ? 'ابحث باسمك في دليل الخريجين...' : 'Search for your name in the graduate directory...'}
          className={`
            w-full rounded-2xl border border-[var(--color-neutral-200)] bg-white
            py-3.5 text-base text-[var(--text-primary)]
            placeholder:text-[var(--color-neutral-400)]
            focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400
            shadow-sm transition-all duration-200
            ${isAr ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4'}
          `}
          dir={isAr ? 'rtl' : 'ltr'}
          autoFocus
        />
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-6">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-neutral-500)] mb-2">
            {isAr ? `${results.length} نتيجة` : `${results.length} result${results.length !== 1 ? 's' : ''}`}
          </p>
          {results.map((graduate) => {
            const name = isAr ? graduate.name_ar : graduate.name_en;
            const initial = (graduate.name_en || graduate.name_ar).charAt(0).toUpperCase();
            const gradient = getGradient(graduate.slug);
            const flag = getFlag(graduate.country);
            const badges = (graduate.certificates ?? []).slice(0, 3);

            return (
              <Card key={graduate.id} className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0 h-12 w-12 rounded-full overflow-hidden">
                    {graduate.photo_url ? (
                      <Image src={graduate.photo_url} alt={name} fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${gradient} text-white text-lg font-bold`}>
                        {initial}
                      </div>
                    )}
                  </div>

                  {/* Name + badges preview */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-bold text-sm text-[var(--text-primary)] line-clamp-1"
                      dir={isAr ? 'rtl' : 'ltr'}
                    >
                      {name}
                      {flag && <span className="ms-1.5 text-sm">{flag}</span>}
                    </h3>
                    {badges.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {badges.map((b) =>
                          b.badge_image_url ? (
                            <div key={b.badge_slug} className="relative h-6 w-6 rounded-full overflow-hidden ring-1 ring-white">
                              <Image src={b.badge_image_url} alt={isAr ? b.badge_label_ar : b.badge_label_en} fill className="object-contain" sizes="24px" />
                            </div>
                          ) : (
                            <div key={b.badge_slug} className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-[10px] font-bold ring-1 ring-white">
                              {(b.badge_label_en || b.badge_label_ar).charAt(0)}
                            </div>
                          )
                        )}
                        {(graduate.certificates ?? []).length > 3 && (
                          <span className="text-xs text-[var(--color-neutral-400)]">
                            +{(graduate.certificates ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Claim button */}
                  <button
                    onClick={() => handleSelect(graduate)}
                    className="
                      shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white
                      min-h-[44px]
                      hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50
                      transition-all duration-200
                    "
                  >
                    {isAr ? 'ربط الملف' : 'Claim'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* No results */}
      {!loading && search.trim().length >= 2 && results.length === 0 && (
        <div className="text-center py-10">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Search className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'لم يتم العثور على نتائج' : 'No graduates found'}
          </p>
          <p className="text-sm text-[var(--color-neutral-400)] mt-1">
            {isAr ? 'جرب البحث باسم مختلف' : 'Try searching with a different name'}
          </p>
        </div>
      )}

      {/* Hint when empty */}
      {!loading && search.trim().length < 2 && results.length === 0 && (
        <div className="text-center py-10">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Search className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'ابدأ بكتابة اسمك للبحث' : 'Start typing your name to search'}
          </p>
        </div>
      )}
    </div>
  );
}
