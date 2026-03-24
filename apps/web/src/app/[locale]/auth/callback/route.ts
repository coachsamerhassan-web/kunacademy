// @ts-nocheck
import { NextResponse } from 'next/server';
import { createServerClient } from '@kunacademy/db';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const locale = searchParams.get('locale') || 'ar';

  if (code) {
    const supabase = createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/${locale}/portal`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/auth/login?error=auth`);
}
