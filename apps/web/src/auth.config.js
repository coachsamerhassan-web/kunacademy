import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
/**
 * Edge-safe auth configuration.
 * NO database imports, NO bcrypt, NO pg, NO nodemailer.
 * Only providers that are safe on the Edge runtime are included here:
 *   - Google (OAuth — no native deps)
 *   - Credentials (stub — no native deps)
 *
 * The Email (magic-link / nodemailer) provider is added ONLY in auth.ts
 * because nodemailer requires Node.js native modules (tls, net, etc.)
 * that are not available in the Edge runtime.
 *
 * Used by middleware. Also spread into auth.ts as the base config.
 */
export const authConfig = {
    session: { strategy: 'jwt' },
    pages: {
        signIn: '/ar/auth/login',
        error: '/ar/auth/login',
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            // Actual authorize logic lives in auth.ts (server-only).
            // This stub is required for provider registration in the edge config.
            authorize: () => null,
        }),
    ],
    callbacks: {
        // Session callback is edge-safe (no DB access)
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.preferred_language = token.preferred_language;
            }
            return session;
        },
    },
};
