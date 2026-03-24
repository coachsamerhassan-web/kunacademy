'use client';

import { useState } from 'react';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

export function LoginForm({ locale }: { locale: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const isAr = locale === 'ar';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const supabase = createBrowserClient() as any;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/${locale}/auth/callback` },
      });
      if (error) throw error;
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-8 rounded-lg bg-green-50 p-6 text-center">
        <p className="text-green-800 font-medium">
          {isAr ? 'تم إرسال رابط الدخول!' : 'Login link sent!'}
        </p>
        <p className="mt-2 text-green-700 text-sm">
          {isAr ? `تحقّق من بريدك ${email}` : `Check your email at ${email}`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          {isAr ? 'البريد الإلكتروني' : 'Email address'}
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20 min-h-[44px]"
          placeholder={isAr ? 'your@email.com' : 'your@email.com'}
          dir="ltr"
        />
      </div>
      {status === 'error' && (
        <p className="text-red-600 text-sm">
          {isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.'}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={status === 'loading'}>
        {status === 'loading'
          ? (isAr ? 'جاري الإرسال...' : 'Sending...')
          : (isAr ? 'أرسل رابط الدخول' : 'Send Login Link')}
      </Button>
    </form>
  );
}
