// @ts-nocheck
import { NextResponse } from 'next/server';
import { createBrowserClient, createAdminClient } from '@kunacademy/db';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const pathParts = new URL(request.url).pathname.split('/');
  const locale = pathParts[1] === 'en' ? 'en' : 'ar';

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login?error=no_code`);
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login?error=config`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login?error=auth`);
  }

  const user = data.user;

  // Check if profile exists and create if not
  try {
    const adminClient = createAdminClient();
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingProfile) {
      await adminClient.from('profiles').insert({
        id: user.id,
        email: user.email!,
        full_name_en: user.user_metadata?.full_name || user.user_metadata?.name || null,
        full_name_ar: user.user_metadata?.full_name_ar || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        role: user.user_metadata?.role || 'student',
      } as any);

      return NextResponse.redirect(`${origin}/${locale}/portal?onboarding=true`);
    }
  } catch {
    // If admin client fails, just redirect
  }

  return NextResponse.redirect(`${origin}/${locale}/portal`);
}
