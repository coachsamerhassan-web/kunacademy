/**
 * @kunacademy/auth/server
 * Server-only exports — never import this in client components or edge runtime.
 * Use `@kunacademy/auth` (index) for client-safe exports.
 */
export { requireAuth, requireAdmin, isAdminRole } from './guards';
export { getAuthUser, requireApiAuth, requireApiAdmin } from './api-helper';
export type { AuthUser } from './api-helper';
