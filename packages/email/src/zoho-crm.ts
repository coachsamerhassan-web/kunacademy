/**
 * Zoho CRM v2 — Contact creation
 * Non-blocking helper: all errors are caught and logged, never thrown.
 */

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let _tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (5-minute buffer)
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 5 * 60 * 1000) {
    return _tokenCache.accessToken;
  }

  const clientId = process.env.ZOHO_CRM_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CRM_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_CRM_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[zoho-crm] Missing env vars: ZOHO_CRM_CLIENT_ID / ZOHO_CRM_CLIENT_SECRET / ZOHO_CRM_REFRESH_TOKEN');
    return null;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error('[zoho-crm] Token refresh HTTP error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();

    if (!data.access_token) {
      console.error('[zoho-crm] Token refresh returned no access_token:', data);
      return null;
    }

    _tokenCache = {
      accessToken: data.access_token as string,
      // Zoho tokens expire in 3600s; cache for that duration
      expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
    };

    return _tokenCache.accessToken;
  } catch (err) {
    console.error('[zoho-crm] Token refresh exception:', err);
    return null;
  }
}

/**
 * Creates a contact in Zoho CRM.
 * @returns The created contact ID, or null on failure.
 * Never throws — all errors are caught and logged.
 */
export async function createZohoCrmContact(
  name: string,
  email: string,
  phone?: string,
  source?: string,
): Promise<string | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    // Zoho CRM requires Last_Name; split full name or use whole name
    const parts = name.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Unknown';
    const firstName = parts.length > 1 ? parts[0] : undefined;

    const fields: Record<string, string> = {
      Last_Name: lastName,
      Email: email,
      Lead_Source: source ?? 'Website Signup',
    };

    if (firstName) fields.First_Name = firstName;
    if (phone) fields.Phone = phone;

    const res = await fetch('https://www.zohoapis.com/crm/v2/Contacts', {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [fields] }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[zoho-crm] Create contact HTTP error:', res.status, body);
      return null;
    }

    const data = await res.json();
    const created = data?.data?.[0];

    if (created?.code === 'SUCCESS' && created?.details?.id) {
      console.log('[zoho-crm] Contact created:', created.details.id, email);
      return created.details.id as string;
    }

    // Duplicate contact — Zoho returns DUPLICATE_DATA
    if (created?.code === 'DUPLICATE_DATA') {
      console.log('[zoho-crm] Duplicate contact, skipping:', email);
      return null;
    }

    console.warn('[zoho-crm] Unexpected response:', JSON.stringify(data));
    return null;
  } catch (err) {
    console.error('[zoho-crm] createZohoCrmContact exception:', err);
    return null;
  }
}
