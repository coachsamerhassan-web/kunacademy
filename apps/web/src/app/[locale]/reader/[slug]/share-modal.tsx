'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  bookSlug: string;
  bookTitle: string;
  senderName: string;
  locale: string;
  onClose: () => void;
}

export function ShareModal({ isOpen, bookSlug, bookTitle, senderName, locale, onClose }: ShareModalProps) {
  const isAr = locale === 'ar';

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch(`/api/books/${bookSlug}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email,
          senderName,
          message: message || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to share');
      }

      setSuccess(true);
      setEmail('');
      setMessage('');

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'شارك الكتاب' : 'Share Book'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-600" aria-hidden="true" />
            <p className="text-green-600 font-medium">
              {isAr ? 'تم إرسال الدعوة!' : 'Invitation sent!'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Book info */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
              <p className="text-gray-600 dark:text-gray-400" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                {isAr ? 'مشاركة' : 'Sharing'}:
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{bookTitle}</p>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                {isAr ? 'البريد الإلكتروني' : 'Email address'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={isAr ? 'name@example.com' : 'name@example.com'}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Message field */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                {isAr ? 'رسالة (اختيارية)' : 'Message (optional)'}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isAr ? 'أضِف رسالة شخصية...' : 'Add a personal message...'}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                rows={3}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={sending || !email}
                className="flex-1 px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors min-h-[44px]"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {isAr ? 'جاري...' : 'Sending...'}
                  </span>
                ) : isAr ? (
                  'أرسِل الدعوة'
                ) : (
                  'Send Invite'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
