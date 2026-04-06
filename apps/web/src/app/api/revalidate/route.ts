// /api/revalidate — On-demand ISR revalidation webhook
// Called by Google Apps Script when content is updated in Google Drive/Sheets.
// Also called by Drive push notifications for auto-trigger on doc changes.
//
// Usage:
//   POST /api/revalidate
//   Headers: x-revalidate-secret: <REVALIDATE_SECRET>
//   Body: { "tags": ["programs", "pages"], "paths": ["/ar/programs/stce"] }
//
// Security: Requires a shared secret to prevent unauthorized cache busting.

import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  const expectedSecret = process.env.REVALIDATE_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      tags?: string[];
      paths?: string[];
      // Google Drive push notification fields
      resourceId?: string;
      channelId?: string;
    };

    const revalidated: string[] = [];

    // Tag-based revalidation (preferred — more granular)
    if (body.tags?.length) {
      for (const tag of body.tags) {
        revalidateTag(tag, 'default');
        revalidated.push(`tag:${tag}`);
      }
    }

    // Path-based revalidation (fallback for specific pages)
    if (body.paths?.length) {
      for (const path of body.paths) {
        revalidatePath(path);
        revalidated.push(`path:${path}`);
      }
    }

    // If no specific tags/paths, revalidate everything
    if (!body.tags?.length && !body.paths?.length) {
      revalidateTag('cms', 'default');
      revalidated.push('tag:cms (full)');
    }

    // Clear the in-memory doc cache too
    try {
      const { invalidateDocCache } = await import('@kunacademy/cms/server');
      invalidateDocCache();
      revalidated.push('doc-cache');
    } catch {
      // CMS package may not export this yet
    }

    console.log('[revalidate] Revalidated:', revalidated.join(', '));
    return NextResponse.json({
      revalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Google Drive push notifications come as POST with specific headers
// Channel ID and resource ID are used to identify what changed
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    usage: 'POST with x-revalidate-secret header and { tags, paths } body',
  });
}
