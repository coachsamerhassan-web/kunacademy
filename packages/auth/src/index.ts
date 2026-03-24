// @kunacademy/auth — Auth logic (login, session, guards)
export { signInWithMagicLink, signOut, getSession, getUser } from './actions';
export { AuthProvider, useAuth } from './context';
export { requireAuth, requireAdmin } from './guards';
