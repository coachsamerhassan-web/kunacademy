import type { NextAuthConfig } from 'next-auth';
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
export declare const authConfig: NextAuthConfig;
//# sourceMappingURL=auth.config.d.ts.map