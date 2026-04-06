/**
 * @kunacademy/auth — client-safe exports only.
 * For server-only functions (requireAuth, requireAdmin, getAuthUser, etc.)
 * import from '@kunacademy/auth/server'.
 */
export { signOut, getSession, getUser } from './actions';
export { AuthProvider, useAuth } from './context';
// isAdminRole is a pure function (no imports) — safe for client, server, and edge
export { isAdminRole } from './roles';
