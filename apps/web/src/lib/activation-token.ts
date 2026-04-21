/**
 * Activation-token helpers — shared between the admin "create user" /
 * "send activation link" endpoints and the reset-password-confirm route
 * (the confirm endpoint also accepts tokens minted here, so admins can use
 * a single URL for both first-login and admin-re-sent activation).
 *
 * Token shape matches createResetToken(): base64url(payload).base64url(hmac).
 * Difference: 7-day expiry (vs. 1 hour for reset), and a `purpose: 'activate'`
 * claim for forward-compat if we diverge the flows later.
 *
 * Validation: verifyActivationOrResetToken() accepts BOTH token shapes by
 * treating `purpose` as optional — any valid HMAC + non-expired payload
 * passes. This keeps the confirm endpoint one piece of code.
 */

import crypto from 'crypto';

export interface TokenPayload {
  email:   string;
  exp:     number;
  iat:     number;
  nonce:   string;
  purpose?: 'activate' | 'reset';
}

export function createActivationToken(email: string, secret: string): string {
  const payload: TokenPayload = {
    email:   email.toLowerCase(),
    exp:     Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days
    iat:     Math.floor(Date.now() / 1000),
    nonce:   crypto.randomBytes(8).toString('hex'),
    purpose: 'activate',
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}
