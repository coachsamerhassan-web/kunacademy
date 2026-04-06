/**
 * Pure role-checking utilities.
 * No imports — safe for client, server, and edge runtimes.
 */

/**
 * Returns true for both 'admin' and 'super_admin' roles.
 * Use this everywhere a role string needs to be checked — never compare
 * against the literal 'admin' string directly, as that misses super_admin.
 */
export function isAdminRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}
