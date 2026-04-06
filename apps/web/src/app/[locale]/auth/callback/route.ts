import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const pathParts = new URL(request.url).pathname.split('/');
  const locale = pathParts[1] === 'en' ? 'en' : 'ar';

  // Auth.js handles OAuth callbacks internally via /api/auth/callback/[provider].
  // This route exists for backward compatibility with existing magic link emails
  // that were issued before the Auth.js migration.
  return NextResponse.redirect(`${origin}/${locale}/dashboard`);
}
