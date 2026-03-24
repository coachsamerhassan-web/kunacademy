import { NextRequest, NextResponse } from 'next/server';

// Meta Conversions API — server-side event tracking
// Requires: META_PIXEL_ID, META_ACCESS_TOKEN in env
export async function POST(request: NextRequest) {
  const { eventName, userData, customData } = await request.json();
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    return NextResponse.json({ status: 'skipped', reason: 'Meta CAPI not configured' });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: userData,
          custom_data: customData,
        }],
        access_token: accessToken,
      }),
    });
    const result = await res.json();
    return NextResponse.json({ status: 'sent', result });
  } catch (err) {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
