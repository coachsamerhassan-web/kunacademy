'use server';

/** Sign out the current user */
export async function signOut() {
  // This is a client-side action wrapper
  // Actual signOut is called from the client via next-auth/react
  return { success: true };
}

/** Get the current session — server-side */
export async function getSession() {
  // Dynamic import to avoid edge runtime issues
  const { auth } = await import('@/auth');
  return auth();
}

/** Get the current user with profile data — server-side */
export async function getUser() {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) return null;

  const { withAdminContext, sql } = await import('@kunacademy/db');
  const profile = await withAdminContext(async (adminDb) => {
    const { rows } = await adminDb.execute(
      sql`SELECT * FROM profiles WHERE id = ${session.user.id}`
    );
    return rows[0] || null;
  });

  return { ...session.user, profile };
}
