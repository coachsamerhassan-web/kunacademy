export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  image?: string | null;
}

/**
 * Get the authenticated user from the Auth.js session.
 * Use in API routes to replace supabase.auth.getUser().
 *
 * @returns AuthUser or null if not authenticated
 *
 * @example
 * export async function GET() {
 *   const user = await getAuthUser();
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   // user.id, user.email, user.role available
 * }
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  // Dynamic import to work from both packages/auth and apps/web
  try {
    const { auth } = await import('@/auth');
    const session = await auth();
    if (!session?.user?.email) return null;

    return {
      id: (session.user as any).id,
      email: session.user.email,
      role: (session.user as any).role || 'student',
      name: session.user.name,
      image: session.user.image,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication — returns user or throws.
 * Use when you always need auth and want to bail early.
 */
export async function requireApiAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * Require admin role — returns user or throws.
 */
export async function requireApiAdmin(): Promise<AuthUser> {
  const user = await requireApiAuth();
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    throw new Error('FORBIDDEN');
  }
  return user;
}
