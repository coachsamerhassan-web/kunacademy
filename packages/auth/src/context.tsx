'use client';

import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';
import { createContext, useContext, type ReactNode } from 'react';

interface AuthState {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
  } | null;
  session: any;
  profile: Record<string, unknown> | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function AuthContextInner({ children }: { children: ReactNode }) {
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const status = sessionResult?.status ?? 'loading';
  const loading = status === 'loading';
  const user = session?.user ? {
    id: (session.user as any).id || '',
    email: session.user.email || '',
    name: session.user.name,
    image: session.user.image,
    role: (session.user as any).role,
  } : null;

  async function handleSignIn(email: string) {
    await signIn('email', { email, callbackUrl: '/ar/dashboard' });
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: '/ar/auth/login' });
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile: user ? (user as any) : null,
      loading,
      signInWithMagicLink: handleSignIn,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextInner>{children}</AuthContextInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
