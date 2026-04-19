import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Email from 'next-auth/providers/email';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { enqueueCrmContactSync } from '@/lib/crm-sync';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Email provider deferred to Wave 9 — requires Drizzle adapter + Resend API key
    // Email({ server: { host: 'smtp.resend.com', port: 465, auth: { user: 'resend', pass: process.env.RESEND_API_KEY } }, from: 'noreply@kunacademy.com' }),

    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const result = await withAdminContext(async (adminDb) => {
          const { rows } = await adminDb.execute(
            sql`SELECT id, email, password_hash, name, image FROM auth_users WHERE email = ${email}`
          );
          return rows[0] as { id: string; email: string; password_hash: string | null; name: string | null; image: string | null } | undefined;
        });

        if (!result || !result.password_hash) return null;

        const isValid = await bcrypt.compare(password, result.password_hash);
        if (!isValid) return null;

        return {
          id: result.id,
          email: result.email,
          name: result.name,
          image: result.image,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const profile = await withAdminContext(async (adminDb) => {
          const { rows } = await adminDb.execute(
            sql`SELECT role, preferred_language FROM profiles WHERE id = ${user.id}`
          );
          return rows[0] as { role: string; preferred_language: string } | undefined;
        });
        token.role = profile?.role || 'student';
        token.preferred_language = profile?.preferred_language || 'ar';
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).preferred_language = token.preferred_language as string;
      }
      return session;
    },

    async signIn({ user, account }) {
      if (!user.email) return false;

      if (account?.provider === 'google') {
        const userName = user.name || '';
        const userImage = user.image || '';
        let isNewProfile = false;

        await withAdminContext(async (adminDb) => {
          await adminDb.execute(
            sql`INSERT INTO auth_users (id, email, email_verified, name, image)
                VALUES (${user.id}, ${user.email}, NOW(), ${userName}, ${userImage})
                ON CONFLICT (email) DO UPDATE SET
                  email_verified = COALESCE(auth_users.email_verified, NOW()),
                  name = COALESCE(NULLIF(${userName}, ''), auth_users.name),
                  image = COALESCE(NULLIF(${userImage}, ''), auth_users.image),
                  updated_at = NOW()
                RETURNING id`
          );

          // xmax = 0 means the row was freshly inserted (not updated by ON CONFLICT)
          const { rows: profileRows } = await adminDb.execute(
            sql`INSERT INTO profiles (id, email, full_name_en, avatar_url, role)
                VALUES (${user.id}, ${user.email}, ${userName}, ${userImage}, 'student')
                ON CONFLICT (id) DO UPDATE SET
                  avatar_url = COALESCE(NULLIF(${userImage}, ''), profiles.avatar_url),
                  full_name_en = COALESCE(NULLIF(${userName}, ''), profiles.full_name_en)
                RETURNING xmax::text AS xmax`
          );
          isNewProfile = (profileRows[0] as { xmax: string } | undefined)?.xmax === '0';
        });

        // Only enqueue on first-time OAuth signup — skip duplicate enqueue on re-auth
        if (isNewProfile) {
          try {
            await enqueueCrmContactSync({
              profile_id:      user.id!,
              full_name:       userName || user.email!.split('@')[0],
              email:           user.email!,
              role:            'client',
              activity_status: 'New',
            });
          } catch (err) {
            console.error('[auth] CRM enqueue failed for Google OAuth signup (non-fatal):', err);
          }
        }
      }
      return true;
    },
  },
});
